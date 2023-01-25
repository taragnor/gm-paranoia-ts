import { getGame } from "./foundry-tools.js";

export class KeyManager {

	static async getKey() : Promise<string> {
		const user = getGame().user;
		if (!user) throw new Error("User Not present for some reason");
		if (!user.isGM)
		return "";
		// return "Test Key";
		let key = await this.checkStorage();
		if (key) return key;
		key = await this.promptUser();
		if (!key)
		throw new Error("User did not provide encyrption key");
		this.storeKey(key);
		return key;
	}

	static async checkStorage() : Promise<string | null> {
		return null;
	}

	static async storeKey(key: string): Promise<void> {

	}

	static async promptUser() : Promise<string | null> {
		return "Test Key";
	}

}
