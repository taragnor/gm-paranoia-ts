import {getGame, localize} from './foundry-tools.js';
import {DataSecurity} from './dataSecurity.js';

type EncryptionType = keyof typeof SecuritySettings.ENCRYPTIONTYPES;



export class SecuritySettings {
	static SYSTEM_NAME = 'gm-paranoia-taragnor';

	static ENCRYPTIONTYPES =  {
		"none" : "TaragnorSecurity.settings.encryptData.0",
		"gmonly": "TaragnorSecurity.settings.encryptData.1",
		"full": "TaragnorSecurity.settings.encryptData.2",
	} as const;

	static init() : void {
		const game = getGame();
		const localizedEncyrptionTypes : {[K in EncryptionType] : string} = {...this.ENCRYPTIONTYPES};
		Object
		.keys(localizedEncyrptionTypes)
		//@ts-ignore
		.forEach( key => localizedEncyrptionTypes[key] = localize(localizedEncyrptionTypes[key] ));

		game.settings.register(this.SYSTEM_NAME, "monitorChanges", {
			name: localize("TaragnorSecurity.settings.monitorChanges.name"),
			hint: localize("TaragnorSecurity.settings.monitorChanges.hint"),
			scope: "world",
			config: true,
			type: Boolean,
			default: true,
			//@ts-ignore
			restrict: true,
			onChange: _ => {
				this.delayedReload();
			}
		});

		game.settings.register(this.SYSTEM_NAME, "monitorRolls", {
			name: localize("TaragnorSecurity.settings.monitorRolls.name"),
			hint: localize("TaragnorSecurity.settings.monitorRolls.hint"),
			scope: "world",
			config: true,
			type: Boolean,
			default: true,
			//@ts-ignore
			restrict: true,
			onChange: _ => {
				this.delayedReload();
			}
		});

		game.settings.register(this.SYSTEM_NAME, "useEncryption", {
			name: localize("TaragnorSecurity.settings.encryptData.name"),
			hint: localize("TaragnorSecurity.settings.encryptData.hint"),
			scope: "world",
			config: true,
			type: String,
			default: "none",
			//@ts-ignore
			choices: localizedEncyrptionTypes,
			//@ts-ignore
			restrict: true,
			onChange: async (_) => {
				if (DataSecurity.instance) {
					this.blockReload = true;
					const msg = localize ("TaragnorSecurity.settings.encryptInProgress");
					ui.notifications!.notify(msg);
					if (game.user!.isGM) {
						await DataSecurity.instance.refreshEncryption();
					}
					const msg2 = localize ("TaragnorSecurity.settings.encryptDone");
					ui.notifications!.notify(msg2);
					this.blockReload = false;
				}
			},
		});

	}

	static get(settingName:string) : unknown {
		const game = getGame();
		return game.settings.get(this.SYSTEM_NAME, settingName);
	}

	static getString(settingName: string) : string {
		const data = this.get(settingName);
		if (typeof data != "string")
			throw new Error(` Data ${settingName} is not a string`);
		return data;
	}

	static getEncryptionType () : EncryptionType {
		try{
			const data = this.getString("useEncryption");
			if (data in this.ENCRYPTIONTYPES)
				return data as EncryptionType;
			else throw new Error(` ${data} is not a valid encryption type`);
		} catch (e) {
			console.log(e);
			console.error("Couldn't get encryption type");
			ui.notifications!.warn("Couldn't get encryption Type, check security settings");
			return "none";
		}
	}

	static getBoolean(settingName: string) : boolean {
		const data = this.get(settingName);
		if (data === true) return true;
		if (data === false) return false;
		throw new Error(`Data ${data} is not boolean`);
	}

	static monitorChanges() : boolean {
		return this.getBoolean("monitorChanges");
	}

	static monitorDiceRolls() : boolean {
		return this.getBoolean("monitorRolls");
	}

	static useEncryption() : boolean {
		return this.getEncryptionType() != "none";
	}

	static encryptAll() : boolean {
		return this.getEncryptionType() == "full";
	}

	static isDelayedReload = false;
	static blockReload = false;

	static delayedReload() {
		const dReload = () => {
			if (this.blockReload) {
				setTimeout(dReload, 2000);
				return
			}
			window.location.reload();
		};
		if (!this.isDelayedReload) {
			const msg = "Reload Required";
			if (ui.notifications)
				ui.notifications.notify(msg);
			setTimeout(() => dReload() , 2000);
		}
		this.isDelayedReload= true;
	}


}
