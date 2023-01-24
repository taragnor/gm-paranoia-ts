import {DataSecurity} from "./dataSecurity.js";
import {Debug} from "./debug.js";

declare class DocumentSheet {
	getData(options: {}) : Promise<{}>;
}

declare class JournalPageSheet {
	getData(options: {}) : Promise<{}>;
}

declare class JournalTextPageSheet {
	getData(options: {}) : Promise<{}>;
}

declare class JournalEntryPage {
	update( data: {}, context: {}) : void;
}

declare global {
	interface Window {
		DocumentSheet: typeof DocumentSheet;
		JournalPageSheet: typeof JournalPageSheet;
		JournalTextPageSheet: typeof JournalTextPageSheet;
		JournalEntryPage: typeof JournalEntryPage;
	}

}

export class JournalFixUps {

	static apply() {
		JournalTextPageSheet.prototype.getData = async function (options = {}) : Promise<{}> {

			const data = JournalPageSheet.prototype.getData.call(this, options);
			this._convertFormats(data);
			console.log(`Pre-Decrypt ${data.document.text.content}`);
			const content = await DataSecurity.instance.decrypt(data.document.text.content);
			console.log(`Post-Decrypt ${content}`);
			data.editor = {
				engine: "prosemirror",
				collaborate: true,
				//@ts-ignore
				content: await TextEditor.enrichHTML(content, {
					//@ts-ignore
					relativeTo: this.object,
					secrets: this.object.isOwner,
					async: true
				})
			};
			Debug(data.editor);
			return data;
		}

		const oldUpdate = JournalEntryPage.prototype.update;
		JournalEntryPage.prototype.update = async function (data: any, context: {}) {
			if (data["text.content"]) {
				const content = data["text.content"];
				if (!DataSecurity.instance.isEncrypted(content)){
					console.log(`Pre Encrypt : ${content}`);
					const encrypted = await DataSecurity.instance.encrypt(content);
					console.log(`PostEncrypt: ${encrypted}`);
					data["text.content"] = encrypted;
				}
			}
			return oldUpdate.apply(this, arguments);


		}

		// Hooks.on("preUpdateJournalEntryPage", async function (page: JournalEntryPage, diff : any, options: {}, id: string)  {
		// 	if (diff["text"]["content"]) {
		// 		diff.text.content = await DataSecurity.instance.encrypt(diff.text.content);
		// 		console.log("Appended");
		// 	}
		// });

	}
}


