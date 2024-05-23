import { Debug } from "./debug.js";

const fromData_oldSecurity = Roll.fromData;
// Roll.fromData_oldSecurity = Roll.fromData;

export {}

export function applyPatch() {

	let anchoredRolls =
		{
			rolls : [] as Roll[],
		};
	Roll.fromData = function (data: any) {
		let roll = fromData_oldSecurity.call(this, data);
		if (roll.security) {
			roll.options._securityTS = roll.security.TS;
			roll.options._securityId = roll.security.log_id;
		}
		roll.security = data.security;
		return roll;
	}

	const toJSON_oldSecurity = Roll.prototype.toJSON;

	Roll.prototype.toJSON = function () {
		let json = toJSON_oldSecurity.call(this);
		json.security = this.security;
		return json;
	}


	const _oldPreCreate = ChatMessage.prototype._preCreate;
	ChatMessage.prototype._preCreate = async function (...args: any[]) {
		anchoredRolls.rolls= [];
		await _oldPreCreate.apply(this, args);
		debugger;
		const data = args[0];
		if (anchoredRolls.rolls.length> 0) {
			if ("rolls" in data) {
				data.rolls.concat(anchoredRolls.rolls);
				await this.updateSource(data);
			} else {
				data.rolls = anchoredRolls.rolls;
				await this.updateSource(data);
			}
			anchoredRolls.rolls= [];
		}
	}

	const _oldtoAnchor = Roll.prototype.toAnchor;
	Roll.prototype.toAnchor = function (...args: unknown[]): HTMLElement {
		if (!anchoredRolls.rolls.includes(this)) {
			anchoredRolls.rolls.push(this);
		}
		return _oldtoAnchor.apply(this,args);
	}


}


