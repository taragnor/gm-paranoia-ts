import { getGame , localize} from "./foundry-tools.js";

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
					const msg = localize("TaragnorSecurity.encryption.error.noKeyProvided")
					ui.notifications!.warn(msg);
					key = null;
					continue;
				}
				const isValid = await validator(key);
				if (!isValid) {
					const msg = localize("TaragnorSecurity.encryption.error.wrongKey" );
					ui.notifications!.warn(msg);
					key = null;
					continue;
				}
			}
		} catch (e: unknown) {
			if (e instanceof Error) {
				ui.notifications!.error(e.message)
				return "";
			}
			throw e;
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

	static async clearKey() : Promise<void> {
		localStorage.removeItem(keylocation)
	}

	static async promptUser() : Promise<string | null> {
		const templateData = {};
		const html = await renderTemplate(`modules/gm-paranoia-taragnor/hbs/key-prompt.hbs`, templateData);
		return await new Promise( (resolve, reject) => {
			const dialog = new Dialog({
				title: "Enter Encryption Key",
				content: html,
				default: "enter",
				buttons: {
					cancel: {
						icon: `<i class="fas fa-times"></i>`,
						label: "Cancel",
						callback: () => resolve(null)
					},
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
				},
				close: function () {
					resolve(null);
				},
			});
			dialog.render(true);
		});
	}


}
