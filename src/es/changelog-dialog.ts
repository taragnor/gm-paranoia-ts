import {ChangeLogger} from "./dataSecurity.js";

class ChangelogDialog extends Dialog {
	async refreshContent() {
		const e = $(this.element);
		e.empty();
		const templateData = {
			log: ChangeLogger.log
		};
		const html = await renderTemplate("module/gm-paranoia-taragnor/hbs/change-log.hbs", templateData);
		e.append(html);


	}


}
