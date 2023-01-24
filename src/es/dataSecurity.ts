import { getGame, Sockets} from "./foundry-tools.js";
import {Debug} from "./debug.js";
import {JournalFixUps} from "./JournalFixups.js";

const ENCRYPTSTARTER = "__#ENCRYPTED#__::[v1]";


enum SocketCommand{
	ENCRYPT_REQUEST= "ENCRYPT-REQUEST",
		DECRYPT_REQUEST= "DECRYPT-REQUEST",
}

export class DataSecurity {

	encryptor: Encryptor;
	promises : Map<string, Promise<string>>;

	static instance: DataSecurity;

	static async keyPrompt() : Promise<string> {
		//TODO: finish this
		return "";
	}

	static init() {
		JournalFixUps.apply();
		this.instance = new DataSecurity("Test Key");
		console.log("Data Security initialized");
	}

	constructor (key: string) {
		this.encryptor = new Encryptor (key);
		this.promises =new Map();
		if (getGame().user!.isGM) {
			Sockets.addHandler( SocketCommand.ENCRYPT_REQUEST, this.onEncryptRequest.bind(this));
			Sockets.addHandler( SocketCommand.DECRYPT_REQUEST, this.onDecryptRequest.bind(this));
		}
	}

	async onEncryptRequest(data: {data:String}): Promise<string> {
		return this.encrypt(data.data +"X" );
	}

	async onDecryptRequest(data: {data:string}): Promise<string> {
		return this.decrypt(data.data + "X");
	}

	isEncrypted (data:string | undefined) : boolean {
		if (!data) return false;
		return (data.startsWith(ENCRYPTSTARTER));
	}

	async decrypt( data:string, force: boolean = false) : Promise<string> {
		console.log("Calling Decrypt base");
		if ( !this.isEncrypted(data) && !force ) return data;
		return await this.#getDecryptedString(data);
	}

	async #getDecryptedString(data: string) : Promise<string> {
		if (!getGame().user!.isGM)
		return await this.sendDecryptRequest(data);
		else
		return this.encryptor.decrypt(data.substring(ENCRYPTSTARTER.length));
	}

	async sendDecryptRequest (data: string) : Promise<string> {
		//send to GM
		const ret = await Sockets.simpleTransaction(
			SocketCommand.DECRYPT_REQUEST,
			{data},
			getGame().users!
			.filter(x=>x.isGM && x.active)
			.map(x=> x.id)
		) as string;
		Debug(ret);
		return ret;
	}

	async encrypt (data: string) : Promise<string> {
		if (this.isEncrypted(data)) return data;
		const starter = ENCRYPTSTARTER;
		const encryptstring = await this.#getEncryptedString(data);
		return starter + encryptstring;
	}

	async #getEncryptedString(data: string) : Promise<string> {
		const game = getGame();
		if (!game.user!.isGM)
		return await this.sendEncryptRequest(data);
		else
		return this.encryptor.encrypt(data);
	}

	async sendEncryptRequest (data: string) : Promise<string> {
		//send to GM
		return await Sockets.simpleTransaction(
			SocketCommand.ENCRYPT_REQUEST,
			{data},
			getGame().users!
			.filter(x=>x.isGM && x.active)
			.map(x=> x.id)
		) as string;
	}

}

class Encryptor {

	#key: string;

	constructor (key: string) {
		this.#key = key;
	}

	encrypt( data: string) : string {
		console.log("Encryptor called");
		let ret = "";
		for (let i = 0 ; i < data.length; i++) {
			const keyCode  = this.#key.charCodeAt(i % this.#key.length)!;
			ret += String.fromCharCode(data.charCodeAt(i) + keyCode);
		}
		return ret;
	}

	decrypt (data: string) : string {
		console.log("Decryptor Full called");
		let ret = "";
		for (let i = 0 ; i < data.length; i++) {
			const keyCode  = this.#key.charCodeAt(i % this.#key.length)!;
			ret += String.fromCharCode(data.charCodeAt(i) - keyCode);
		}
		return ret;
	}

}

//@ts-ignore
window.DataSecurity = DataSecurity;
