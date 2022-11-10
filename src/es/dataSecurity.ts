import {getGame} from "./foundry-tools.js";

interface ChangeGroup {
	id: string; //ID of changed object
	playerId: string; //player who changed
	changes: RecursiveArray<ChangeEntry>;
}

interface ChangeEntry {
	oldValue: any;
	key: string;
	newValue: any;
}

interface FoundryChangeLog {
	system : ArbitraryObject;
	_id: string;
	_stats : {
		modifiedTime: number;
		lastModifiedBy: string;
	};
}

type RecursiveArray<T> = (T | T[])[];

export class ChangeLogger {
	static logFilePath : string = "";
	static source: Parameters<typeof FilePicker.upload>[0]
	static folder : string;


	static init() {
		// Hooks.on("updateActor", this.onActorUpdate.bind(this));
		// Hooks.on("preUpdateActor", this.onActorPreUpdate.bind(this));
		// this.initSource();
	}

	static async onActorPreUpdate( actor: Actor, changes: FoundryChangeLog, _options: {}, userId:string  ) {
		const oldS = actor.system;
		const newS = changes.system;
		if (!actor.id) throw new Error("Null Id");
		const list = this.getChangeGroup(oldS, newS, userId, actor.id);
		console.log("Update");
		console.log(list);
		await this.storeChanges(list);
	}

	//static async initSource () {
	//	//TODO: resolve this and set a source
	//	const fp = new FilePicker(<any>{
	//		title: 'DF_CHAT_ARCHIVE.Settings.ArchiveFolder_Name',
	//		type: 'folder',
	//		field: input,
	//		callback: async (path: string) => {
	//			this.source = fp.activeSource;
	//			this.folder = path;
	//		},
	//		button: event.currentTarget
	//	});
	//}

	static getChangeGroup(oldData: ArbitraryObject, newData: ArbitraryObject, playerId: string, FoundryDocumentId: string) : ChangeGroup {
		const changes = this.iterateObject( oldData, newData);
		return {
			id: FoundryDocumentId,
			playerId,
			changes: changes,
		};
	}

	static iterateObject ( oldData : ArbitraryObject, newData: ArbitraryObject) : RecursiveArray<ChangeEntry> {
		return Object.entries(newData)
			.map( ([key, val]) => {
				const oldval = oldData[key];
				if (typeof val == "object") {
					return this.iterateObject(oldval, newData);
				} else {
					return {
						key,
						oldValue: oldval,
						newValue: val,
					};
				}
			})
		.flat(1);
	}

	static async storeChanges(list: ChangeGroup) : Promise<void> {
		//TODO: open log file, save to thing
		const game = getGame();
		const path = `./worlds/${game.world.id}/data/`;
		const json = JSON.stringify(list);
		try {
			const file = new File([json], "changelog.db"); //
			FilePicker.upload(this.source, path, file);
		} catch (e) {
			throw e;
		}
	}

	// static async readChanges(list: ChangeGroup) : Promise<ChangeGroup[]> {
	// 	const game = getGame();
	// 	const path = `./worlds/${game.world.id}/data/changelog.db`;
	// 	try {
	// 		const data : string = await new Promise ( (conf, rej) => {
	// 			fs.readFile(path, 'utf8', (err, data) => {
	// 				if (err)
	// 					rej(err);
	// 				else
	// 					conf(data);
	// 			});
	// 		});
	// 		return JSON.parse(data);
	// 	} catch (e) {
	// 		ui.notifications!.error("Read error on changelog.db");
	// 		throw e;
	// 	}
	// }
}

