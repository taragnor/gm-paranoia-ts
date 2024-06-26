import { getGame, Sockets, localize} from "./foundry-tools.js";
import {Debug} from "./debug.js";
import {JournalFixUps} from "./JournalFixups.js";
import {KeyManager} from "./keymanager.js";
import {SecuritySettings, EncryptionSettings} from "./security-settings.js";
import {ChangeLogger} from './changeLogger.js';
import { Encryptor } from "./encryptor.js";

const PRE_HOOK_NAME= "encryptionPreEnable";
const POST_HOOK_NAME = "encryptionEnable";

declare global {
	interface HOOKS {
	 "encryptionPreEnable": (dataSecurity: typeof DataSecurity) => unknown;
 "encryptionEnable" : (dataSecurity: typeof DataSecurity) => unknown;
	}


}

enum SocketCommand {
	ENCRYPT_REQUEST= "ENCRYPT-REQUEST",
		DECRYPT_REQUEST= "DECRYPT-REQUEST",
}

interface DecryptRequestObj {
	id: string;
	field: string;
};

interface EncryptRequestObj {
	id: string;
	field: string;
	dataString: string
};

type DecryptTargetObjects = Actor | Item | JournalEntryPage;


type AnyItem = typeof Item | typeof Actor | typeof JournalEntryPage;
type SheetType = typeof JournalEntryPage;

type ConstructorOf<T extends {constructor: Object}> = T["constructor"];


export class DataSecurity {

	encryptor: Encryptor;
	promises : Map<string, Promise<string>>;
	static errors: Error[] = [];

	static _instance: DataSecurity;
	static encryptables: Map<ConstructorOf<DecryptTargetObjects>, string[]>;

	static get instance() {
		return this._instance;
	}

	static async init() {
		const game = getGame();
		if (SecuritySettings.keyChangeInProgress()) {
			SecuritySettings.refreshEncryption();

		}
		this.encryptables = new Map();
		Hooks.on(PRE_HOOK_NAME, (dataSecurity: typeof DataSecurity) => {
			JournalFixUps.apply(dataSecurity);
		});
		try {
			Hooks.callAll(PRE_HOOK_NAME, this);
		}
		catch (e) {
			ui.notifications!.error("Error running hooks on encryptionPreEnable");
			console.error(e);
		}
		if (game.user!.isGM) {
			const key = await KeyManager.getKey((key:string) => this.validateKey(key));
			this._instance = new DataSecurity(key);
		}
		console.log("Data Security initialized");
		Hooks.callAll(POST_HOOK_NAME, this);
	}

	/** instructs DatjaSecurity to encrypt the data field on the given data item class and any relevant sheets that use it
	 @param baseClass The document type (Actor, Journal, etc) that contains the object
	 @param sheets an array of sheets that you want to be affected
	 @param fields an array of fields you want encrypted in format "system.details.biography"
	 */
	static setEncryptable( baseClass: AnyItem, sheets: SheetType[], fields: string[])  {
		this.encryptables.set(baseClass, fields);
		this.#applyMainItem(baseClass, fields);
		this.#applySheets(sheets, fields);
	}


	/** Invoked when a setting is changed and we want to change the global encryption on all data.*/
	static async changeEncryptionLevel(newSettings:EncryptionSettings ) {
		if (DataSecurity.instance) {
			const game = getGame();
			SecuritySettings.blockReload = true;
			let msg;
			switch (newSettings.useEncryption) {
				case "none":
					msg = localize ("TaragnorSecurity.settings.decryptInProgress");
					break;
				case "gmonly":
				case "full":
					msg = localize ("TaragnorSecurity.settings.encryptInProgress");
					break;
				default:
					throw new Error(` Bad setting ${newSettings.useEncryption}`)
			}
			ui.notifications!.notify(msg);
			if (game.user!.isGM) {
				ChangeLogger.suspendLogging();
				try {
					await DataSecurity.instance.refreshEncryption();
					// await DataSecurity.instance.refreshEncryption();
					const msg2 = localize ("TaragnorSecurity.settings.encryptDone");
					ui.notifications!.notify(msg2);
				} catch (e) {
					ui.notifications!.error("Something went wrong, trying emergency Decrypt!");
					if( await DataSecurity.emergencyDecrypt())
						ui.notifications!.notify("Emergency Decrypt finished okay");
					else
						ui.notifications!.error("Emergency Decrypt fail, data loss possible");

				}
			}
			SecuritySettings.blockReload = false;
			ChangeLogger.resumeLogging();
		}
	}

	static async emergencyDecrypt(key?: string, listFail= false) : Promise<boolean>{
		const encryptables = await DataSecurity.getAllEncryptables();
		// console.log(`Refreshing Encyrption ${encryptables.length}`);
		if (key != undefined)
			this.instance.encryptor.updateKey(key);
		let fail = 0, success=0;
		let failList : string[] = [];
		ChangeLogger.suspendLogging();
		for (const [obj, field] of encryptables) {
			//@ts-ignore
			await obj.reset();
			const data = DataSecurity.getFieldValue(obj, field);
			if (!obj.id || !data) {
				continue;
			}
			const shouldBeEncyrpted = DataSecurity.isEncryptableObject(obj);
			const isEncrypted = DataSecurity.isEncrypted(data);
			if (isEncrypted) {
				try {
					const eData = await DataSecurity.decrypt(obj.id, field);
					const updateObj : {[k: string] : string} ={};
					updateObj[field] = eData;
					// console.log(`Modifying Encryption of ${obj?.name}`);
					await obj.update(updateObj, {ignoreEncrypt:true});
					success++;

				} catch (e) {
					fail++;
					//@ts-ignore
					failList.push (`id: ${obj.id}, name: ${obj?.name} . ` );
				}
			}
		}
		console.log(`Emergency Decrypt ${success} successes, ${fail} failures`);
		if (listFail)
			console.log(failList);
		ChangeLogger.resumeLogging();
		return fail == 0;
	}

	static #applyMainItem(baseClass: AnyItem, fields: string[]) {
		const oldUpdate  = baseClass.prototype.update;
		baseClass.prototype.update =
			async function (data: any, context?: {ignoreEncrypt?: boolean}) {
				for (const field of fields) {
					if (context?.ignoreEncrypt) continue;
					if (data[field]) {
						const content = data[field];
						if (!DataSecurity.isEncrypted(content)) {
							try {
								const encrypted = await DataSecurity.encrypt(this.id, field, content);
								data[field] = encrypted;
							} catch (e) {
								ui.notifications!.error(`Encryption Error on ${field}, on ${this.name}`);
								Debug(this);
								console.log(e);
							}
						}
					}
				}
				return oldUpdate.apply(this, arguments);
			}
		//@ts-ignore
		baseClass.prototype.decryptData = async function () {
			for (const field of fields) {
				try {
					// console.log(`Decrypting Data for ${this.name}`);
					const decryptedContent = await DataSecurity.decrypt(this.id, field);
					DataSecurity.setFieldValue(this, field, decryptedContent);
				} catch (e) {
					DataSecurity.errors.push(e);
				}
			}
		}
	}

	static #applySheets(sheets: SheetType[], fields:string[]) {
		for (let sheet of sheets) {
			//@ts-ignore
			const oldgetData = sheet.prototype.getData;
			//@ts-ignore
			sheet.prototype.getData =
				async function (this: InstanceType<typeof sheet>, options= {}) {
					if ("object" in  this && "decryptData" in (this.object as object))
						await (this.object as any).decryptData();
					const data = await oldgetData.call(this, options);
					for (const field of fields) {
						//@ts-ignore
						const item = this.document;
						if (!item)
							throw new Error("Couldn't find item on sheet.name");
						const itemId = item.id;
						if (!itemId)
							throw new Error(`Can't get item Id for ${item.name}`);
						const decryptedContent = await DataSecurity.decrypt(itemId, field);
						const fieldSplit = field.split(".").reverse();
						let x : any = item;
						let y : any = data?.actor ?? data?.item;
						let z : any = data;
						DataSecurity.setFieldValue(x, field, decryptedContent);
						DataSecurity.setFieldValue(y, field, decryptedContent);
						DataSecurity.setFieldValue(z, field, decryptedContent);
						if (data.editor) {
							data.editor.content  = await TextEditor.enrichHTML(decryptedContent, {
								//@ts-ignore
								relativeTo: this.object,
								//@ts-ignore
								secrets: this.object.isOwner,
								async: true
							});
						}
						Debug(data);
						return data;
					}
				}
		}
	}

	constructor (key: string) {
		this.encryptor = new Encryptor (key);
		this.promises =new Map();
		if (getGame().user!.isGM) {
			Sockets.addHandler( SocketCommand.ENCRYPT_REQUEST, this.onEncryptRequest.bind(this));
			Sockets.addHandler( SocketCommand.DECRYPT_REQUEST, this.onDecryptRequest.bind(this));
		}
	}

	async onEncryptRequest({id,field, dataString}: EncryptRequestObj, {sender}: SocketPayload  ): Promise<string> {
		return DataSecurity.encrypt(id, field, dataString);
	}

	async onDecryptRequest({id,field}: DecryptRequestObj, {sender}:SocketPayload): Promise<string> {
		//TODO: Check permissions
		const hasPermission = await this.checkPermissions(sender, id, field);
		if (!hasPermission) {
			return "ACCESS DENIED";
		}
		return DataSecurity.decrypt(id, field);
	}

	async checkPermissions(userId: string, objectId: string, field:string) : Promise<boolean> {
		const game = getGame();
		const user = game.users!.get(userId);
		if (!user) {
			const msg = `Can't find sender Id ${userId}`;
			console.warn(msg);
			throw new Error(msg);
		}
		if (user.isGM) {
			const msg =  `Someone tried to impersonate a GM`;
			ui.notifications!.warn(msg);
			console.warn(msg);
		}
		const [obj, _data] = await DataSecurity.findData(objectId, field);
		//@ts-ignore
		const tester : Actor | Item | JournalEntry = obj instanceof JournalEntryPage ? obj.parent : obj;
		if (!tester.testUserPermission(user, "OBSERVER" ,{exact: false})) {
			return false;
		}
		return true;
	}

	static isEncrypted (data:string | undefined) : boolean {
		return Encryptor.isEncrypted(data);
	}

	static async decrypt(targetObjId: string, targetObjField: string, force = false) : Promise<string> {
		try {
			const [obj, data] = await DataSecurity.findData(targetObjId, targetObjField);
			if (!data) return "";
			if ( !DataSecurity.isEncrypted(data) && !force ) return data;
			return await this.#getDecryptedString( data, targetObjId, targetObjField);
		} catch (e) {
			try {
				this.errors.push(e);
				ui.notifications!.error("Error on Decryption");
			} catch (e2) {
				console.error("Error on Decryption (couldn't use ui");
			}
			throw e;
		}
	}

	static async #getDecryptedString(data: string, objId : string, field: string) : Promise<string> {
		if (!getGame().user!.isGM)
		return await this.sendDecryptRequest(objId, field);
		else
		return this.instance.encryptor.decrypt(data);
	}

	static async sendDecryptRequest (objId: string, field: string) : Promise<string> {
		//send to GM
		const ret = await Sockets.simpleTransaction(
			SocketCommand.DECRYPT_REQUEST,
			{
				id: objId,
				field
			} satisfies DecryptRequestObj,
			getGame().users!
			.filter(x=>x.isGM && x.active)
			.map(x=> x.id)
		) as string;
		return ret;
	}

	static isEncryptableObject(obj : DecryptTargetObjects) : boolean {
		if (!SecuritySettings.useEncryption()) return false;
		const game = getGame();
		if (!SecuritySettings.encryptAll()) { //check for player ownership here
			const players = game.users!.filter (x=> !x.isGM);
			const tester : Actor<any> | Item<any> | JournalEntry = obj instanceof JournalEntryPage ? obj.parent : obj;
			if (players.some( plyr => tester.testUserPermission(plyr, "OBSERVER", {exact:false})))
				return false; //don't encrypt if players can see it
		}
		return true;
	}

	static async encrypt (targetObjId: string, targetObjField: string, data: string | undefined | null) : Promise<string> {
		if (data == null) return "";
		const [obj, _oldData] = await DataSecurity.findData(targetObjId, targetObjField);
		if (!this.isEncryptableObject(obj)) return data;
		if (DataSecurity.isEncrypted(data)) return data;
		return await this.#getEncryptedString(data, targetObjId, targetObjField);
	}

	static async findData(targetObjId: string, targetObjField: string): Promise<[DecryptTargetObjects, string | undefined | null]> {
		const game = getGame();
		const obj = game.journal!.contents
		.map( //@ts-ignore
			x=> x.pages.contents)
		.flat(1)
		.find(x=> x.id == targetObjId)
		?? game.actors!
		.find(x=> x.id == targetObjId)
		?? game.items!
		.find(x=> x.id == targetObjId)
		?? game.actors!
		.find (
			actor => {
				const items = actor.items;
				return items.contents
					.some( i => i.id == targetObjId);
			})
		?.items.find( i => i.id ==targetObjId)
		?? DataSecurity._findData_tokenScan(targetObjId)
		?? await DataSecurity._findData_compendiumScan(targetObjId);
		if (!obj) {
			throw new Error(`Couldn't find ID: ${targetObjId}`);
		}
		const fieldValue = this.getFieldValue(obj, targetObjField);
		return [obj, fieldValue];
	}

	static _findData_tokenScan ( targetObjId: string) : Actor<any> | Item<any> | undefined {
		const game = getGame();
		const tokenActors = game.scenes!.contents
		.flatMap(
			scene=> scene.tokens.contents.map( tok => tok.actor)
		).filter( x=> x != null);
		return tokenActors.find( actor => actor?.id == targetObjId)
		??
			tokenActors.flatMap(x=> x?.items.contents)
		.find (item => item?.id == targetObjId);
	}


	static async _findData_compendiumScan (targetObjId: string) : Promise< Actor<any> | Item<any> | undefined> {
		const game = getGame();
		for (const pack of game.packs) {
			switch ( pack.documentName ) {
				case "Actor": {
					const query = {};
					const packActors : Actor<any>[] = await pack.getDocuments(query);
					const retobj : Actor<any> | Item<any> | undefined = packActors
					.find( (x: Actor)=> x.id == targetObjId)
					?? pack
					.find( (x: Actor)=> x.items
						.contents
						.some(i=> i.id == targetObjId)
					)?.items.find((i: Item) => i.id == targetObjId);
					if (retobj) return retobj;
					continue;
				}
				case "Item": {
					const packItem : Item = await pack.getDocument(targetObjId);
					if (packItem) return packItem;
					continue;
				}
				default:
					continue;
			}
		}
		return undefined;
	}

	static async #getEncryptedString(data: string, objId: string, field:string) : Promise<string> {
		const game = getGame();
		if (!game.user!.isGM)
		return await this.sendEncryptRequest(data, objId, field);
		else
		return this.instance.encryptor.encrypt(data);
	}

	static async sendEncryptRequest (stringToEncrypt: string,objId: string, field:string) : Promise<string> {
		//send to GM
		const GMs =	getGame().users!
		.filter(x=>x.isGM && x.active)
		.map(x=> x.id);
		if (GMs.length == 0) return stringToEncrypt;
		const EncryptRequestObj : EncryptRequestObj =
		{ id: objId,
			field,
			dataString : stringToEncrypt
		};
		return await Sockets.simpleTransaction(
			SocketCommand.ENCRYPT_REQUEST,
			EncryptRequestObj,
			GMs
		) as string;
	}

	/** returns a tuple of
	[encryptableObjects[],
	encryptoablefields[] ]
	Does not test each object for any ownership concerns
	 */
	static async getAllEncryptablesTuple() : Promise<(readonly [DecryptTargetObjects[], string[] ]) []> {
		const game = getGame();
		const x = this.encryptables
		.entries();
		const tokenActors = game.scenes!.contents
		.flatMap( sc => sc.tokens.contents.map( tok => tok.actor))
		.filter( x=> x) as Actor[] ;
		const actors : Actor[] = game.actors!.contents.map(x=>x).concat(tokenActors);
		let xArr = [];
		for (const o of x) {
			xArr.push(o);
		}
		const data : (readonly [DecryptTargetObjects[], string[]])[] =
		xArr.map( ([cls, fields]) => {
			if ((cls as any).collectionName =="actors") {
				const ret :readonly [DecryptTargetObjects[], string[]]   = [actors, fields] as const;
				return ret;
			}
			else if ((cls as any).collectionName == "items") {
				const x= game.items!.contents.map(x=>x) as Item[];
				const items = actors.map(x=> {
					const items=  x.items.contents.map(x=>x);
					return items;
				}).flat(1);
				const combined =  x.concat(items);
				const ret :readonly [DecryptTargetObjects[], string[]] = [combined, fields] as const;
				return ret;
			}
			else if ((cls as unknown) == JournalEntryPage) {
				const pages= game.journal!.contents
					.map(x=> {
						const pageArr = (x as any).pages.contents as JournalEntryPage[];
						return pageArr;
					})
					.flat(1);
				const ret : readonly [DecryptTargetObjects[], string[]] = [pages, fields] as const;
				return ret;
			} else {
				Debug(cls);
				throw new Error(`Unknown type ${(cls as any)?.name}`);
			}
		});
		return data;
	}

	static async getAllEncryptables() : Promise <[DecryptTargetObjects, string] []> {
		const initial  = await DataSecurity.getAllEncryptablesTuple();
		return initial.map( ([objArr, fieldsArr]) => {
			const ret : [DecryptTargetObjects, string][] =  objArr
				.map( (obj) => {
					const r = fieldsArr.map(
						(field) : [DecryptTargetObjects, string] => [obj, field] );
					return r;
				})
				.flat(1);
			return ret;
		})
		.flat(1);
	}


	static async validateKey(potentialKey: string, debug= true) : Promise<boolean> {
		const encryptor = new Encryptor(potentialKey);
		const encryptables = await this.getAllEncryptables();
		return encryptables.every( ([obj , field]) => {
			//@ts-ignore
			obj.reset();
			const data =  DataSecurity.getFieldValue(obj, field);
			if (!data || !DataSecurity.isEncrypted(data))
				return true;
			try {
				encryptor.decrypt(data);
				return true;
			}
			catch (e) {
				if (debug) {
					//@ts-ignore
					console.log(`Object Id: ${obj.id}, Object: ${obj?.name},${field}`);
					console.log(e);
				}
				return false;
			}
		});
	}

	static async resetKey() {
		await KeyManager.clearKey();
	}

	static getFieldValue(item: {[key:string]:any}, field:string) : string | undefined | null {
		let x : unknown  = item;
		const peices = field
			.split(".")
			.reverse();
		while (typeof x != "string") {
			const part = peices.pop();
			if (!part) {
				Debug(x, item,field);
				throw new Error(`Malformed Type, no data found at ${field}`)
			}
			x = (x as {[key:string]: unknown})[part];
			if (typeof x == "undefined")
				return undefined ;
			if (typeof x == "number")
				throw new Error(`Field ${field} is a number, numeric encryption not yet allowed`);
			if ( x === null)
				return null;
		}
		return x;
	}

	static setFieldValue(item: {[key:string]:any} , field:string, newVal: string) : boolean {
		const fieldSplit = field
			.split(".")
			.reverse();
		let x : any = item;
		while (fieldSplit.length > 1) {
			if (typeof x != "object")
				return false;
			const str = fieldSplit.pop()!;
			x = x[str];
		}
		const f = fieldSplit.pop();
		if (!f) {
			// throw new Error("Splits empty? not enough fields provided?");
			return false;
		}
		if (typeof x != "object")
			return false;
		x[f] = newVal;
		return true;
	}

	//* update encyrption style to newest settings
	async refreshEncryption () {
		const encryptables = await DataSecurity.getAllEncryptables();
		// console.log(`Refreshing Encyrption ${encryptables.length}`);
		for (const [obj, field] of encryptables) {
			//@ts-ignore
			await obj.reset();
			const data = DataSecurity.getFieldValue(obj, field);
			if (!obj.id || !data) {
				continue;
			}
			const shouldBeEncyrpted = DataSecurity.isEncryptableObject(obj);
			const isEncrypted = DataSecurity.isEncrypted(data);
			if (shouldBeEncyrpted && !isEncrypted) {
				// const eData = await DataSecurity.encrypt(obj.id, field, data);
				const value = DataSecurity.getFieldValue(obj, field);
				if (typeof value == "string") {
					const eData =  DataSecurity.instance.encryptor.encrypt(value);
					const updateObj : {[k: string] : string} ={};
					updateObj[field] = eData;
					await obj.update(updateObj, {ignoreEncrypt:true});
				}
			}  else if (!shouldBeEncyrpted && isEncrypted) {
				// const eData = await DataSecurity.decrypt(obj.id, field);
				const eData = DataSecurity.instance.encryptor.decrypt(DataSecurity.getFieldValue(obj, field) ?? "");
				const updateObj : {[k: string] : string} ={};
				updateObj[field] = eData;
				await obj.update(updateObj, {ignoreEncrypt:true});
			}
		}
	}

	static encryptTest(key:string, str: string) {
		const crypt = new Encryptor(key);
		const crypted = crypt.encrypt(str);
		const decrypted = crypt.decrypt(crypted);
		if (decrypted != str)
			throw new Error(`Mismatch ${str} and ${decrypted}`);
		return crypted;
	}

	static decryptTest(key:string, str: string) {
		const crypt = new Encryptor(key);
		return crypt.decrypt(str);
	}
}


//Left to allow systems to implement encryption
//@ts-ignore
window.DataSecurity = DataSecurity;
