interface Changes {
	playerId: string;
	oldValue: any;
	key: string;
	newValue: any;
	__isChanges: boolean;
}

interface ChangeLog {
	system : ArbitraryObject;
	_id: string;
	_stats : {
		modifiedTime: number;
		lastModifiedBy: string;
	};
}

type RecursiveArray<T> = (T | T[])[];

export class DataSecurity {
	static logFilePath : string = "";

	static init() {
		// Hooks.on("updateActor", this.onActorUpdate.bind(this));
		Hooks.on("preUpdateActor", this.onActorPreUpdate.bind(this));
	}

	static onActorPreUpdate( actor: Actor, changes: ChangeLog, _options: {}, userId:string  ) {
		const oldS = actor.system;
		const newS = changes.system;
		const list = this.iterateObject(oldS, newS, userId);
		console.log("Update");
		console.log(list);
		this.storeChanges(list);
	}

	static iterateObject ( oldData : ArbitraryObject, newData: ArbitraryObject, playerId: string) : RecursiveArray<Changes> {
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
						__isChanges: true,
					};
				}
			})
		.flat(1);
	}

	static isChanges(x: ArbitraryObject) : x is Changes {
		if (x.__isChanges) return true;
		return false;
	}

	static storeChanges(list: RecursiveArray<Changes>) : void {
		//TODO: open log file, save to thing

	}

}


