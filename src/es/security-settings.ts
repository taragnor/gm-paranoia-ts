import {getGame, localize} from './foundry-tools.js';

export class SecuritySettings {
	static SYSTEM_NAME = 'gm-paranoia-taragnor';

	static init() : void{
		const game = getGame();
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
				setTimeout(() =>  window.location.reload(), 500);
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
				setTimeout(() =>  window.location.reload(), 500);
			}
		});

	}

	static get(settingName:string) : unknown {
		const game = getGame();
		return game.settings.get(this.SYSTEM_NAME, settingName);
	}

	static getBoolean(settingName: string) : boolean {
		const data = this.get(settingName);
		if (data == true) return true;
		if (data == false) return false;
		throw new Error(`Data ${data} is not boolean`);
	}

	static monitorChanges() : boolean {
		return this.getBoolean("monitorChanges");
	}

	static monitorDiceRolls() : boolean {
		return this.getBoolean("monitorRolls");
	}

}
