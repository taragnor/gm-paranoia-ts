import {getGame} from "./foundry-tools.js";
import {ChangelogDialog} from "./changelog-dialog.js";
import {StorageManager} from "./dataStorage.js";
import {ChangeGroup, ChangeEntry, RecursiveArray} from "./change-group.js";
import {Debug} from "./debug.js";

export interface FoundryChangeLog {
	system ?: ArbitraryObject;
	name ?: string;
	_id: string;
	_stats : {
		modifiedTime: number;
		lastModifiedBy: string;
	};
}


export class ChangeLogger {
	static logFilePath : string = "";
	static folder : string;
	static log: ChangeGroup[];

	static init() {
		// Hooks.on("updateActor", this.onActorUpdate.bind(this));
		Hooks.on("preUpdateActor", this.onAnyPreUpdate.bind(this));
		Hooks.on("preUpdateItem", this.onAnyPreUpdate.bind(this));
		StorageManager.initSource();
		this.log = [];
	}

	// static async onActorPreUpdate( actor: Actor, changes: FoundryChangeLog, _options: {}, userId:string  ) {
	// 	const item = actor;
	// 	if (!item.id) throw new Error("Null Id");
	// 	let CG  = new ChangeGroup(item.id, userId);
	// 	if (changes.system) {
	// 		const oldS = item.system;
	// 		const newS = changes.system;
	// 		const list = this.getChangeGroup(oldS, newS, userId, item.id);
	// 		CG.merge(list);
	// 	}
	// 	if (changes.name) {
	// 		const oldN = item.name;
	// 		const newN = changes.name;
	// 		CG.add("name", oldN, newN);
	// 	}
	// 	console.log("Update");
	// 	console.log(CG);
	// 	this.log.push(CG);
	// }


	static async onAnyPreUpdate(thing: Item | Actor, changes: FoundryChangeLog, _options: {}, userId: string) {
		const item = thing;
		if (!item.id) throw new Error("Null Id");
		let CG  = new ChangeGroup(item.id, userId);
		if (changes.system) {
			const oldS = item.system;
			const newS = changes.system;
			const list = this.getChangeGroup(oldS, newS, userId, item.id);
			CG.merge(list);
		}
		if (changes.name) {
			const oldN = item.name;
			const newN = changes.name;
			CG.add("name", oldN, newN);
		}
		console.log("Update");
		console.log(CG);
		this.log.push(CG);
	}

	// static async onItemPreUpdate( item: Item, changes: FoundryChangeLog, _options:{}, userId: string) {
	// 	const oldS = item.system;
	// 	const newS = changes.system;
	// 	if (!item.id) throw new Error("Null Id");
	// 	const list = this.getChangeGroup(oldS, newS, userId, item.id);
	// 	console.log("Update");
	// 	console.log(changes);
	// 	console.log(list);
	// 	this.log.push(list);

	// }

	static getChangeGroup(oldData: ArbitraryObject, newData: ArbitraryObject, playerId: string, FoundryDocumentId: string) : ChangeGroup {
		const changes = this.iterateObject( oldData, newData);
		const CG = new ChangeGroup( FoundryDocumentId, playerId);
		CG.addChangeEntries(changes);
		return CG;
	}

	static iterateObject ( oldData : ArbitraryObject, newData: ArbitraryObject, prefix: String[]  = []) : RecursiveArray<ChangeEntry> {
		try {
			return Object.entries(newData)
				.map( ([key, val]) => {
					let oldval;
					try {
						oldval = oldData[key];
					} catch (e){
						console.error(`Problem with key ${key}`);
						throw e;
					}
					if (typeof val == "object" && val) {
						return this.iterateObject(oldval, newData[key], [...prefix, key]);
					} else {
						return {
							key: [...prefix, key].join("."),
							oldValue: oldval,
							newValue: val,
						};
					}
				})
				.flat(1);
		} catch (e)  {
			Debug(oldData,newData, prefix);
			console.error(e);
			throw new Error("Problem with iterateObject");
		}
	}

}

