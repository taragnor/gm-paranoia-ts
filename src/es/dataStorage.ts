import {ChangeGroup, ChangeEntry} from "./change-group.js";
import {FoundryChangeLog} from "./dataSecurity.js";
import {getGame} from "./foundry-tools.js";


export class StorageManager {

	static source: Parameters<typeof FilePicker.upload>[0]

	static async initSource () {
		//TODO: resolve this and set a source
		// const fp = new FilePicker(<any>{
		// 	title: 'DF_CHAT_ARCHIVE.Settings.ArchiveFolder_Name',
		// 	type: 'folder',
		// 	field: input,
		// 	callback: async (path: string) => {
		// 		this.source = fp.activeSource;
		// 		this.folder = path;
		// 	},
		// 	button: event.currentTarget
		// });
	}

	static async readChanges() : Promise<ChangeGroup[]> {
		const game = getGame();
		const path = `./worlds/${game.world.id}/data/changelog.db`;
		return []; // placehodler
	}

	static async storeChanges(list: ChangeGroup[]) : Promise<void> {
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


}

