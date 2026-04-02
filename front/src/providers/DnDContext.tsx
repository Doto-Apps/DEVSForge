import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useContext,
	useState,
} from "react";

type DndContextType = [string | null, Dispatch<SetStateAction<string | null>>];

const DnDContext = createContext<DndContextType>([null, () => {}]);

type Props = {
	children: ReactNode;
};

export const DnDProvider = ({ children }: Props) => {
	const [dragId, setDragId] = useState<string | null>(null);

	return (
		<DnDContext.Provider value={[dragId, setDragId]}>
			{children}
		</DnDContext.Provider>
	);
};

export const useDnD = () => {
	return useContext(DnDContext);
};
