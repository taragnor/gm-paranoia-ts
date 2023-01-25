import {DataSecurity} from "./dataSecurity.js";
import {Debug} from "./debug.js";


export class JournalFixUps {

	static apply() {
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

//function oldSheetApplyFn() : void {

//	//@ts-ignore
//		JournalTextPageSheet.prototype.getData = async function (options = {}) : Promise<{}> {

//			const data = JournalPageSheet.prototype.getData.call(this, options);
//			this._convertFormats(data);
//			// console.log(`Pre-Decrypt ${data.document.text.content}`);
//			const content = await DataSecurity.instance.decrypt(data.document.id, "text.content");
//			// const content = await DataSecurity.instance.decrypt(data.document.text.content);
//			// console.log(`Post-Decrypt ${content}`);
//			//This line overwrites it for some reason
//			this.document.text.content = content;
//			data.editor = {
//				engine: "prosemirror",
//				collaborate: true,
//				//@ts-ignore
//				content: await TextEditor.enrichHTML(content, {
//					//@ts-ignore
//					relativeTo: this.object,
//					secrets: this.object.isOwner,
//					async: true
//				})
//			};
//			// Debug(this);
//			return data;
//		}
//}



function oldApplyFn() : void {
		// const oldUpdate = JournalEntryPage.prototype.update;
		// JournalEntryPage.prototype.update = async function (data: any, context: {}) {
		// 	if (data["text.content"]) {
		// 		// console.warn("Update Action");
		// 		const content = data["text.content"];
		// 		if (!DataSecurity.instance.isEncrypted(content)){
		// 			// console.log(`Pre Encrypt : ${content}`);
		// 			try {
		// 			const encrypted = await DataSecurity.instance.encrypt(this.id, "text.content", content);
		// 			// console.log(`PostEncrypt: ${encrypted}`);
		// 			data["text.content"] = encrypted;
		// 			} catch (e) {
		// 				ui.notifications!.error("Encryption Error");
		// 				// console.log(e);
		// 			}
		// 		} else {
		// 			// console.log(`Not encrypted: ${data["text.content"]}`);
		// 			// Debug(data["text.content"]);

		// 		}
		// 	} else {
		// 		// console.log("No op Update");
		// 		// Debug(data);
		// 	}
		// 	return oldUpdate.apply(this, arguments);
		// }

}

