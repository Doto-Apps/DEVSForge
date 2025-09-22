import React from "react";
import { DiagramDataType } from "../types";

interface StepShowerProps {
  diagramData: DiagramDataType;
}

const StepShower: React.FC<StepShowerProps> = ({ diagramData }) => {
  const { models, currentModel } = diagramData;

  return (
    <div className=" w-full flex justify-center">
      {models.map((model, index) => (
        <div className="flex items-center" key={model.id}>
          <div
            className={`h-6 w-6 rounded-full flex items-center justify-center ${
              index === currentModel ? "bg-blue-500" : "bg-foreground"
            }`}
          >
            <div className="text-background text-xs">{index + 1}</div>
            <div
              className={`absolute translate-y-6 text-xs ${
                index === currentModel ? "text-blue-500" : "text-foreground"
              }`}
            >
              {model.name}
            </div>
          </div>
          {models.length !== index + 1 ? (
            <div className="h-1 w-10 bg-foreground flex-grow min-w-20"></div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default StepShower;
