const fromData_oldSecurity = Roll.fromData;
// Roll.fromData_oldSecurity = Roll.fromData;

export {}

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

