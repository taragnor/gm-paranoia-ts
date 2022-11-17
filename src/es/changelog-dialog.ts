import {ChangeLogger} from "./dataSecurity.js";

export class ChangelogDialog extends Dialog {

	constructor () {
		super( {
			title: "Change Log",
			content: "",
			close: () =>  {},
			render: () => {
				this.onRender();
			},
			buttons: {
				close: {
					label: "close",
					icon: "close",
					callback: () => {},
				},
			}
		});
	}

	static create() {
		const dialog = new ChangelogDialog();
		dialog.render(true);
		return dialog;
	}

	async onRender() {
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
		const e = $(this.element);
		e.empty();
		const html = await this.getContent();
		e.append(html);
	}


}
