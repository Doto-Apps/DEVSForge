import type { components } from "@/api/v1";
export const DEFAULT_NODE_SIZE = 200;
export const DEFAULT_POSITION = { x: 0, y: 0 };
export const INTERNAL_PREFIX = "internal-";

export const POSSIBLE_PARAMETER_TYPE: components["schemas"]["json.ParameterType"][] =
	["int", "float", "bool", "string", "object"];

export const PYTHON_LINES = {
	INIT_DECLARATION_START: /def\s+__init__\(.*\)/,
	PORTS_IN_DICTIONNARY_START: "self.portsIn = ",
	PORTS_IN_DICTIONNARY_OUT: "self.portsOut = ",
};
