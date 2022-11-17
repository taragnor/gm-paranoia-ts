
export class SecurityHandlebarsStuff {
		static templateParts = [
			"modules/gm-paranoia-taragnor/hbs/changelog-subtable.hbs",
		];

	static init() {
		this.loadTemplates();
	}

	static loadTemplates() {
		loadTemplates(this.templateParts);
	}

}
