import {DataSecurity} from "./dataSecurity.js";
import {Debug} from "./debug.js";


export class JournalFixUps {

	static apply(dataSecurity: typeof DataSecurity) {
		//@ts-ignore
		DataSecurity.setEncryptable( JournalEntryPage, [JournalTextPageSheet], ["text.content"]);
	}

	//EXPIREMENTAL DOESNT WORK YET
	static applyDnD() {
		// D&D test code
		//@ts-ignore
		const mainActor = CONFIG.Actor.documentClass;
		//@ts-ignore
		const sheet = CONFIG.Actor.sheetClasses.character['dnd5e.ActorSheet5eCharacter'].cls;
		DataSecurity.setEncryptable(mainActor , [sheet], ["system.details.biography.value", "system.details.biography.public"])
	}

}





