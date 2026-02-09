package enum

type ModelLanguage string

const (
	ModelLanguageGo     ModelLanguage = "go"
	ModelLanguagePython ModelLanguage = "python"
)

func (m ModelLanguage) String() string {
	return string(m)
}

func (m ModelLanguage) IsValid() bool {
	switch m {
	case ModelLanguageGo, ModelLanguagePython:
		return true
	}
	return false
}

// AllModelLanguages returns all available model languages
func AllModelLanguages() []ModelLanguage {
	return []ModelLanguage{
		ModelLanguageGo,
		ModelLanguagePython,
	}
}
