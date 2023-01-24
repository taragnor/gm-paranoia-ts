import {ChangeLogger} from "./changeLogger.js";
import {Debug} from "./debug.js";

let CLDialog: ChangelogDialog | null = null;

export class ChangelogDialog extends Dialog {

	dataElement: JQuery<HTMLElement>;

	constructor () {
		// TODO: Why wont this work?
		super( {
			title: "Change Log",
			content: "",
			close: () =>  {CLDialog = null},
			render: () => {
				this.onRender();
			},
			buttons: {
				close: {
					label: "close",
					// icon: "close",
					callback: () => {},
				},
			},
			default: "close",
		});
	}

	static create() {
		if (CLDialog) {
			CLDialog.refreshContent();
		}
		else {
			const dialog = new ChangelogDialog();
			CLDialog = dialog;
			dialog.render(true);
		}
		return CLDialog;
	}

	async onRender() {
		setTimeout( () => {
			this.element.css("height","auto");
			this.element.css("width","auto");
			this.element.css("top", "150px");
		}, 100); //set to trigger shortly after init so this doesn't get overwritten
		this.dataElement = $("<div> </div>");
		this.element.find(".dialog-content").append(this.dataElement);
		this.refreshContent();
	}

	async getContent() {
		const templateData = {
			log: ChangeLogger.log
		};
		const html = await renderTemplate("modules/gm-paranoia-taragnor/hbs/change-log.hbs", templateData);
		return html;
	}

	async refreshContent() {
		// const e = $(this.element);
		const e = $(this.dataElement);
		e.empty();
		const html = await this.getContent();
		e.append($(html));
		$($(html)).css("height", "auto important!");

	}


}

Hooks.on("updateActor", () => { if (CLDialog) CLDialog.refreshContent();});
Hooks.on("updateItem", () => { if (CLDialog) CLDialog.refreshContent();});

//@ts-ignore
window.ChangelogDialog = ChangelogDialog;
