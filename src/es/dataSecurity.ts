interface Changes {
	playerId: string;
	oldValue: any;
	key: string;
	newValue: any;
}

interface ChangeLog {
	system : ArbitraryObject;
	_id: string;
	_stats : {
		modifiedTime: number;
		lastModifiedBy: string;
	};
}

export class DataSecurity {

	static init() {
		// Hooks.on("updateActor", this.onActorUpdate.bind(this));
		Hooks.on("preUpdateActor", this.onActorPreUpdate.bind(this));
	}


	static onActorPreUpdate( actor: Actor, changes: ChangeLog, _options: {}, userId:string  ) {
		const oldS = actor.system;
		const newS = changes.system;
		const list = this.iterateObject(oldS, newS, userId);
		console.log("Update");
		console.log(arguments);
		console.log(list);
	}

	static iterateObject ( oldData : ArbitraryObject, newData: ArbitraryObject, playerId: string) : Changes[] {
		return Object.entries(newData)
			.map( ([key, val]) => {
				const oldval = oldData[key];
				if (typeof val == "object") {
					return this.iterateObject(oldval, newData, playerId);
				} else {
					return {
						playerId,
						key,
						oldValue: oldval,
						newValue: val,
					};
				}
			})
		.flat(1);
	}
}


