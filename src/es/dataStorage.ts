import {ChangeGroup, ChangeEntry} from "./change-group.js";
import {FoundryChangeLog} from "./dataSecurity.js";
import {getGame} from "./foundry-tools.js";
import {Debug} from "./debug.js";


export class StorageManager {

	static async initSource () {
		await this.ensureDirectoryCreated();
	}

	static async readChanges() : Promise<ChangeGroup[]> {
		if (!this.ensureDirectoryCreated()) {
			return [];
		}
		const fileList : string[] = await this.getLogList();
		const promises = fileList.map( (fileName) => this.getChanges(fileName));
		const resolved = await Promise.all(promises);
		const simplified =(resolved
			.filter(x => x)
			.flat(1)
		);
		simplified.sort( (a,b) => b.time - a.time);
		return simplified;
	}

	static async getLogList() : Promise<string[]> {
		const game = getGame();
		const path = `./worlds/${game.world.id}/paranoia-files/`;
		const fileData = await FilePicker.browse("data", path);
		return fileData.files;
	}

	static async getChanges(fileNameAndPath: string) : Promise<ChangeGroup[]> {
		if (!(await this.ensureDirectoryCreated() )) {
			return [];
		}
		const game = getGame();
		const data = await fetch(fileNameAndPath);
		const json : ChangeGroup[] = await data.json();
		if (Array.isArray(json)) {
			return json.map( (json) => {
				const CG = new ChangeGroup(json.id, json.type, json.playerId, json.parentId, json.time);
				CG.changes = json.changes;
				return CG;
			});
		}
		return [];
	}

	static async storeChanges(list: ChangeGroup[]) : Promise<void> {
		let now = new Date();
		now.setHours(0, 0, 0);
		const startOfDay = now.getTime();
		const todayList = list.filter( item => {
			const x= new Date(item.time);
			return x.getTime() - startOfDay > 0;
		});
		if (!this.ensureDirectoryCreated()) return;
		const date = new Date();
		const LogName = date.toISOString().split("T")[0] + ".json";
		await this.writeFile(LogName, todayList);
	}

	static async writeFile(fileName: string, list: ChangeGroup[]) {
		const game = getGame();
		const stringData : string = JSON.stringify(list);
		const blob: Blob = new Blob([stringData], {
			type: "text/plain"
		});
		const path = `./worlds/${game.world.id}/paranoia-files`;
		const file: File = new File([blob], fileName);
		//@ts-ignore
		await FilePicker.upload("data", `${path}`,file, {}, {notify:false} );
	}

	static async ensureDirectoryCreated() {
		const game = getGame();
		const path = `./worlds/${game.world.id}`;
		const gamepath  = await FilePicker.browse("data", path);
		const dirs = gamepath.dirs;
		if (!dirs.map( x=> {
			return x.split("/").pop();}).includes("paranoia-files")) {
			try {
				await FilePicker.createDirectory("data", `${path}/paranoia-files`);
			} catch (e) {
				console.log(e);
				ui.notifications?.error("Can't create Paranoia Files Directory");
				console.error("Can't create paranoia files directory");
				throw e;
			}
		}
		return true;
	}
}



