package enum

type ModelLanguage string

const (
	ModelLanguageGo     ModelLanguage = "go"
	ModelLanguagePython ModelLanguage = "python"
	ModelLanguageJava   ModelLanguage = "java"
)

func (m ModelLanguage) String() string {
	return string(m)
}

func (m ModelLanguage) IsValid() bool {
	switch m {
	case ModelLanguageGo, ModelLanguagePython, ModelLanguageJava:
		return true
	}
	return false
}

// AllModelLanguages returns all available model languages
func AllModelLanguages() []ModelLanguage {
	return []ModelLanguage{
		ModelLanguageGo,
		ModelLanguagePython,
		ModelLanguageJava,
	}
}
