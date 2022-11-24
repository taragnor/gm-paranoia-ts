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

	static async init() {
		Hooks.on("preUpdateActor", this.onAnyPreUpdate.bind(this));
		Hooks.on("preUpdateItem", this.onAnyPreUpdate.bind(this));
		StorageManager.initSource();
		this.log = await StorageManager.readChanges();
		console.log("Log Loaded Successfully");
	}

	static async notifyGM (thing: Item | Actor, changes: FoundryChangeLog, options: {}, userId: string) {
		//TODO: need to socket over to GM
	}

	static async onAnyPreUpdate(thing: Item | Actor, changes: FoundryChangeLog, options: {}, userId: string) {
		const game = getGame();
		if (!game.user!.isGM) {
			await this.notifyGM(thing, changes, options, userId);
			return;}
		const item = thing;
		if (!item.id) throw new Error("Null Id");
		let type: "Actor" | "Item";
		if ("items" in thing)
			type = "Actor";
		else type = "Item";
		const parentId = thing.parent ? thing.parent.id! : "";
		let CG  = new ChangeGroup(item.id, type, userId, parentId);
		if (changes.system) {
			const oldS = item.system;
			const newS = changes.system;
			const list = this.getChangeGroup(oldS, newS, userId, item.id, type);
			CG.merge(list);
		}
		if (changes.name) {
			const oldN = item.name;
			const newN = changes.name;
			CG.add("name", oldN, newN);
		}
		this.log.unshift(CG);
		StorageManager.storeChanges(this.log);
	}

	static getChangeGroup(oldData: ArbitraryObject, newData: ArbitraryObject, playerId: string, FoundryDocumentId: string, type: "Actor" | "Item") : ChangeGroup {
		const changes = this.iterateObject( oldData, newData);
		const CG = new ChangeGroup( FoundryDocumentId, type, playerId);
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

Hooks.on("getSceneControlButtons", function(controls:any) {
	const game = getGame();
	let tileControls = controls.find( (x: {name: string}) => x.name === "token");
	if (game.user!.isGM) {
		tileControls.tools.push({
			icon: "fas fa-file",
			name: "ChangeLog",
			title: "Change Log",
			button: true,
			onClick: () => ChangelogDialog.create()
		});
	}
});



