package services

import "strings"

// Framework identity alone does not establish compatibility with the installed API.
func ImportedSourceIssue(integrationID, code string) string {
	if integrationID != "ms4me-java" {
		return ""
	}
	for _, symbol := range []string{"com.ms4systems.devs.core.model.impl.AtomicModelImpl", "com.ms4systems.devs.core.model.impl.CoupledModelImpl", "com.ms4systems.devs.core.message.MessageBag", "com.ms4systems.devs.core.message.impl.MessageBagImpl"} {
		if strings.Contains(code, symbol) {
			return "This MS4 Me source uses an API variant absent from the installed runner (" + symbol + "). Adapt the source to the installed MS4 Me API before simulation."
		}
	}
	if strings.Contains(code, "extends PhaseAtomic") && !strings.Contains(code, "class PhaseAtomic") {
		return "The local PhaseAtomic superclass is missing from this atomic model's executable source. Include and adapt the helper before simulation."
	}
	return ""
}
