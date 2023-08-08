const ENCRYPTSTARTER = "<p>__#ENCRYPTED#__::[v1]</p>";
import { localize } from "./foundry-tools.js";

export class Encryptor {

	#key: string;

	constructor (key: string) {
		this.#key = key;
	}

	encrypt (data: string) : string {
		return ENCRYPTSTARTER + this._encrypt(data);
	}

	updateKey(key: string) {
		this.#key = key;
	}

	private _encrypt(data : string) : string {
		// console.log("Encryptor called");
		if (this.#key.length == 0) {
			const msg = localize("TaragnorSecurity.encryption.error.missingKey");
			ui.notifications!.error(msg)
			throw new Error(msg);
		}
		const target = "1" + data + "Z"; //add padding for verification
		let ret = "";
		for (let i = 0 ; i < target.length; i++) {
			const keyCode  = this.#key.charCodeAt(i % this.#key.length)!;
			ret += String.fromCharCode(target.charCodeAt(i) + keyCode);
		}
		return ret;
	}


	getEncryptionVersion(data:string) : number {
		//will be used in the future to decode the data in ECRYPTSTARTER TO GET THE VERSION NUMBER
		return 1;
	}

	static isEncrypted (data:string | undefined | null) : boolean {
		if (!data) return false;
		return (data.startsWith(ENCRYPTSTARTER));
	}

	decrypt (data:string | null | undefined) : string {
		if (data == null) return "";
		const version = this.getEncryptionVersion(data);
		switch (version) {
			case 1:
				return this._decrypt1(data.substring(ENCRYPTSTARTER.length));
			default:
				throw new Error(`Unrecognized Version number: ${version}`);
		}
	}

	private _decrypt1 (data: string) : string {
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
			return ret.substring(1, ret.length-1);
		else throw new Error(`Decryption failed: ${data}`);
	}

}

