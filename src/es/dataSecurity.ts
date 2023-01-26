import { getGame, Sockets, localize} from "./foundry-tools.js";
import {Debug} from "./debug.js";
import {JournalFixUps} from "./JournalFixups.js";
import {KeyManager} from "./keymanager.js";

const ENCRYPTSTARTER = "<p>__#ENCRYPTED#__::[v1]</p>";


enum SocketCommand{
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


type AnyItem = ConstructorOf<Item | Actor | JournalEntryPage>;
type SheetType = ConstructorOf<DocumentSheet>

	const HOOK_NAME= "encryptionPreEnable";

export class DataSecurity {

	encryptor: Encryptor;
	promises : Map<string, Promise<string>>;

	static _instance: DataSecurity;
	static encryptables: Map<ConstructorOf<DecryptTargetObjects>, string[]>;


	static get instance() {
		return this._instance;

	}

	static async init() {
		const game = getGame();
		this.encryptables = new Map();
		Hooks.on(HOOK_NAME, (dataSecurity: typeof DataSecurity) => {
			JournalFixUps.apply(dataSecurity);
		});
		try {
			await Hooks.callAll(HOOK_NAME, this);
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
	}

	/** instructs DatjaSecurity to encrypt the data field on the given data item class and any relevant sheets that use it
	*/
	static setEncryptable( baseClass: AnyItem, sheets: SheetType[], fields: string[])  {
		this.encryptables.set(baseClass, fields);
		this.#applyMainItem(baseClass, fields);
		this.#applySheets(sheets, fields);
	}

	static #applyMainItem(baseClass: AnyItem, fields: string[]) {
		const oldUpdate  = baseClass.prototype.update;
		baseClass.prototype.update =
			async function (data: any, context: {}) {
				for (const field of fields) {
					if (data[field]) {
						const content = data[field];
						if (!DataSecurity.instance.isEncrypted(content)){
							try {
								const encrypted = await DataSecurity.instance.encrypt(this.id, field, content);
								data[field] = encrypted;
							} catch (e) {
								ui.notifications!.error(`Encryption Error on ${field}`);
							}
						}
					}
				}
				return oldUpdate.apply(this, arguments);
			}
	}

	static #applySheets(sheets: SheetType[], fields:string[]) {
		for (let sheet of sheets) {
			const oldgetData = sheet.prototype.getData;
			sheet.prototype.getData =
				async function (this: InstanceType<typeof sheet>, options= {}) {
					const data = await oldgetData.call(this, options);
					for (const field of fields) {
						const item = this.document;
						if (!item)
							throw new Error("Couldn't find item on sheet.name");
						const itemId = item.id;
						if (!itemId)
							throw new Error(`Can't get item Id for ${item.name}`);
						const decryptedContent = await DataSecurity.instance.decrypt(itemId, field)
						const fieldSplit = field.split(".").reverse();
						let x : any = item;
						let y : any = data?.actor ?? data?.item;
						let z : any = data;
						while (fieldSplit.length > 1) {
							const str = fieldSplit.pop()!;
							x = x[str];
							if (y)
								y = y[str];
							if (z)
								z = z[str];
						}
						const f = fieldSplit.pop();
						if (!f) throw new Error("Splits empty? not enough fields provided?");
						x[f] = decryptedContent;
						if (y)
							y[f] = decryptedContent;
						if (z)
							z[f] = decryptedContent;
						if (data.editor) {
							data.editor.content  = await TextEditor.enrichHTML(decryptedContent, {
								//@ts-ignore
								relativeTo: this.object,
								//@ts-ignore
								secrets: this.object.isOwner,
								async: true
							});
						}
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
		return this.encrypt(id, field, dataString);
	}

	async onDecryptRequest({id,field}: DecryptRequestObj, {sender}:SocketPayload): Promise<string> {
		//TODO: Check permissions
		const hasPermission = await this.checkPermissions(sender, id, field);
		if (!hasPermission) {
			return "ACCESS DENIED";
		}
		return this.decrypt(id, field);
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
		const tester = obj instanceof JournalEntryPage ? obj.parent : obj;
		if (!tester.testUserPermission(user, "OBSERVER"))
			return false;
		return true;
	}

	isEncrypted (data:string | undefined) : boolean {
		if (!data) return false;
		return (data.startsWith(ENCRYPTSTARTER));
	}

	async decrypt(targetObjId: string, targetObjField: string, force = false) : Promise<string> {
		try {
			const [obj, data] = await DataSecurity.findData(targetObjId, targetObjField);
			if (!data) return "";
			if ( !this.isEncrypted(data) && !force ) return data;
			return await this.#getDecryptedString( data, targetObjId, targetObjField);
		} catch (e) {
			ui.notifications!.error("Error on Decryption");
			throw e;
		}
	}

	async #getDecryptedString(data: string, objId : string, field: string) : Promise<string> {
		if (!getGame().user!.isGM)
		return await this.sendDecryptRequest(objId, field);
		else
		return this.encryptor.decrypt(data.substring(ENCRYPTSTARTER.length));
	}

	async sendDecryptRequest (objId: string, field: string) : Promise<string> {
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

	async encrypt (targetObjId: string, targetObjField: string, data: string) : Promise<string> {

		const [obj, _oldData] = await DataSecurity.findData(targetObjId, targetObjField);
		if (this.isEncrypted(data)) return data;
		return await this.#getEncryptedString(data, targetObjId, targetObjField);
	}

	static async findData(targetObjId: string, targetObjField: string): Promise<[DecryptTargetObjects, string | undefined]> {
		const game = getGame();
		const obj = game.journal!
		.map( //@ts-ignore
			x=> x.pages.contents)
		.flat(1)
		.find(x=> x.id == targetObjId)
		??
		game.actors!
		.find(x=> x.id == targetObjId)
		??
		game.items!
		.find(x=> x.id == targetObjId);
		if (!obj)
		throw new Error(`Couldn't find ID: ${targetObjId}`);
		const fieldValue = this.getFieldValue(obj, targetObjField);
		return [obj, fieldValue];
		// let x : unknown = obj;
		// const peices = targetObjField
		// .split(".")
		// .reverse();
		// while (typeof x != "string") {
		// 	const part = peices.pop();
		// 	if (!part) {
		// 		Debug(x, obj, targetObjField);
		// 		throw new Error(`Malformed Type, no data found at ${targetObjField}`)
		// 	}
		// 	x = (x as {[key:string]: unknown})[part];
			// if (typeof x == "undefined")
			// 	return [obj, undefined] ;
		// }
		// return [obj, x];
	}

	async #getEncryptedString(data: string, objId: string, field:string) : Promise<string> {
		const game = getGame();
		const starter = ENCRYPTSTARTER;
		if (!game.user!.isGM)
		return await this.sendEncryptRequest(data, objId, field);
		else
		return starter + this.encryptor.encrypt(data);
	}

	async sendEncryptRequest (stringToEncrypt: string,objId: string, field:string) : Promise<string> {
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

	static async getAllEncryptedValues() : Promise<[DecryptTargetObjects, string[]][]> {
		return [];

	}

	static async validateKey(potentialKey: string) : Promise<boolean> {
		const encryptor = new Encryptor(potentialKey);
		const encyrptables : [DecryptTargetObjects, string[]][]  = await this.getAllEncryptedValues();
		return encyrptables.every( o => {
			return false;
		});
	}

	static getFieldValue(item: AnyItem, field:string) : string | undefined {
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
				throw new Error(`Field ${field} is a number, numeric encyrption not yet allowed`);
		}
		return x;
	}
}




class Encryptor {

	#key: string;

	constructor (key: string) {
		this.#key = key;
	}

	encrypt(data : string) : string {
		// console.log("Encryptor called");
		if (this.#key.length == 0){
			const msg = localize("TaragnorSecurity.encryption.error.missingKey");
			ui.notifications!.error(msg)
			throw new Error(msg);
		}
		const target = "1" + data +"Z"; //add padding for verification
		let ret = "";
		for (let i = 0 ; i < target.length; i++) {
			const keyCode  = this.#key.charCodeAt(i % this.#key.length)!;
			ret += String.fromCharCode(target.charCodeAt(i) + keyCode);
		}
		return ret;
	}

	decrypt (data: string) : string {
		// console.log("Decryptor Full called");
		if (this.#key.length == 0) {
			const msg = localize("TaragnorSecurity.encryption.error.missingKey");
			ui.notifications!.error(msg)
			throw new Error(msg);
		}
		let ret = "";
		for (let i = 0 ; i < data.length; i++) {
			const keyCode  = this.#key.charCodeAt(i % this.#key.length)!;
			ret += String.fromCharCode(data.charCodeAt(i) - keyCode);
		}
		if (ret.startsWith("1") && ret.endsWith("Z"))
			return ret.substring(1, ret.length-2);
		else throw new Error(`Decryption failed: ${data}`);
	}

}

//@ts-ignore
window.DataSecurity = DataSecurity;
