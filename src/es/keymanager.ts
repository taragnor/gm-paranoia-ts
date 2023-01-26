import { getGame } from "./foundry-tools.js";

const keylocation = "gm-paranoia-key";

export class KeyManager {

	static async getKey(validator: (key:string) => Promise<boolean>) : Promise<string> {
		const user = getGame().user;
		if (!user) {
			throw new Error("User Not present for some reason");
		}
		if (!user.isGM) {
			return "";
		}
		// return "Test Key";
		let key = await this.retrieveKeyFromStorage();
		if (key) return key;
		try {
			while (!key) {
				key = await this.promptUser();
				if (!key) {
					throw new Error("User did not provide encyrption key");
				}
				const isValid = await validator(key);
				if (!isValid) {
					ui.notifications!.warn("Key Conflicts with existing Encrypted Values");
					key = null;
				}
			}
		} catch (e) {
			ui.notifications!.error("No Key entered, Encryption non-functional")
			return "";
		}
		this.storeKey(key);
		return key;
	}

	static async retrieveKeyFromStorage() : Promise<string | null> {
		const key = localStorage.getItem(keylocation);
		return key;
	}

	static async storeKey(key: string): Promise<void> {
		localStorage.setItem(keylocation, key);
		ui.notifications!.notify("Key stored");
	}

	static async promptUser() : Promise<string | null> {
		const templateData = {};
		const html = await renderTemplate(`modules/gm-paranoia-taragnor/hbs/key-prompt.hbs`, templateData);
		return await new Promise( (resolve, reject) => {
			const dialog = new Dialog({
				title: "Enter Encryption Key",
				content: html,
				buttons: {
					enter:  {
						icon: `<i class="fas fa-check"></i>`,
						label: "Confirm",
						callback: (html) => {
							const key = $(html).find(".key-entry").val();
							if (typeof key == "string")
								resolve (key);
							else
								reject("Bad Data");
						}
					},
					cancel: {
						icon: `<i class="fas fa-times"></i>`,
						label: "Cancel",
						callback: () => resolve(null)
					}
				},
				close: function () {
					resolve(null);
				},
			});
			dialog.render(true);
		});
	}


	static #validateKey(key: string) {
		//TODO: make sure key doesn't conflict with already encrypted values, check all values
	}

}
