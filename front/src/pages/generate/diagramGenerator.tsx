"use client";

import {
  useState,
  useCallback,
  useLayoutEffect,
  ComponentProps,
  useEffect,
  useRef,
} from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable.tsx";

import {
  ReactFlow,
  addEdge,
  Background,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
  Node,
  EdgeChange,
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import { ZoomSlider } from "../../components/zoom-slider.tsx";
import ResizerNode from "../../components/custom/reactFlow/ResizerNode.tsx";
import BiDirectionalEdge from "../../components/custom/reactFlow/BiDirectionalEdge.tsx";
import { getLayoutedElements } from "@/lib/getLayoutedElements.ts";

import {
  initialNodes,
  initialEdges,
} from "../../staticModel/initialElements.tsx";

import { Button } from "../../components/ui/button.tsx";
import DiagramPrompt from "./diagramPrompt.tsx";
import { SidebarTrigger } from "../../components/ui/sidebar.tsx";
import { Separator } from "../../components/ui/separator.tsx";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "../../components/ui/breadcrumb.tsx";
import { NavActions } from "../../components/nav/nav-actions.tsx";
import { ModeToggle } from "../../components/mode-toggle.tsx";

import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";

import ModelPrompt from "../../modelPrompt.tsx";
import StepShower from "../../components/stepShower.tsx";

import { ModelData, DiagramDataType, NodeData } from "@/types";
import { useTheme } from "../../components/theme-provider.tsx";
import { saveDiagram } from "../../api/diagramApi.ts";
import { useAuth } from "@/providers/AuthProvider.tsx";

/* ---------------------------------- CFG ---------------------------------- */

const nodeTypes: ComponentProps<typeof ReactFlow>["nodeTypes"] = {
  resizer: ResizerNode,
};

const defaultEdgeOptions = {
  type: "step",
  animated: true,
  style: { zIndex: 1000 },
};

const edgeTypes = {
  bidirectional: BiDirectionalEdge,
};

type RFNode = Node<NodeData>;
type RFEdge = Edge;

/* ------------------------------- small utils ------------------------------ */

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** compare vite fait : id + position + size (si présent) + ports (taille) + targets/sources */
function isSameLayout(aNodes: RFNode[], aEdges: RFEdge[], bNodes: RFNode[], bEdges: RFEdge[]) {
  if (aNodes.length !== bNodes.length || aEdges.length !== bEdges.length) return false;

  const mapA = new Map(aNodes.map(n => [n.id, n]));
  for (const bn of bNodes) {
    const an = mapA.get(bn.id);
    if (!an) return false;
    const ap = an.position, bp = bn.position;
    if (!ap || !bp) return false;
    if (ap.x !== bp.x || ap.y !== bp.y) return false;
    const aw = (an.style as any)?.width, bw = (bn.style as any)?.width;
    const ah = (an.style as any)?.height, bh = (bn.style as any)?.height;
    if (aw !== bw || ah !== bh) return false;
  }

  const E = (e: RFEdge) => `${e.id ?? ""}|${e.source}->${e.target}`;
  const setA = new Set(aEdges.map(E));
  for (const e of bEdges) if (!setA.has(E(e))) return false;

  return true;
}

/* -------------------------------- Component ------------------------------- */

const DiagramGenerator = () => {
  const lastSavedDiagram = useRef<DiagramDataType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { theme } = useTheme();
  const { fitView } = useReactFlow();
  const { token } = useAuth();

  // stages: 0 = prompt, 1 = diagram view, 2 = model/code view
  const [stage, setStage] = useState(0);

  const [code, setCode] = useState("// Hello, CodeMirror!");

  const [diagramData, setDiagramData] = useState<DiagramDataType | undefined>({
    name: "Unamed model",
    diagramId: null,
    nodes: initialNodes,
    edges: initialEdges,
    models: [],
    currentModel: 0,
  });

  // --- layout orchestration ---
  const layoutReqId = useRef(0);
  const layoutTimer = useRef<number | null>(null);

  const schedule = (fn: () => void, ms = 60) => {
    if (layoutTimer.current) {
      window.clearTimeout(layoutTimer.current);
      layoutTimer.current = null;
    }
    // petit debounce “façon timeout” pour coller à ta manière
    layoutTimer.current = window.setTimeout(fn, ms);
  };

  const runLayout = useCallback(
    (nodes: RFNode[], edges: RFEdge[], direction: "RIGHT" | "LEFT" | "UP" | "DOWN" = "RIGHT") => {
      const myId = ++layoutReqId.current;
      return getLayoutedElements(nodes, edges, direction).then(({ nodes: n, edges: e }) => {
        // ignore résultats obsolètes
        if (myId !== layoutReqId.current) return;

        setDiagramData(prev => {
          if (!prev) return prev;
          // évite la boucle si rien n'a vraiment changé
          const same = isSameLayout(prev.nodes as RFNode[], prev.edges as RFEdge[], n as RFNode[], e as RFEdge[]);
          if (same) return prev;

          return { ...prev, nodes: n as RFNode[], edges: e as RFEdge[] };
        });

        requestAnimationFrame(() => fitView());
      });
    },
    [fitView]
  );

  /* ----------------------------- ReactFlow events ----------------------------- */

  const onNodesChange = useCallback((changes: NodeChange<Node<NodeData>>[]) => {
    setDiagramData(prev =>
      prev
        ? {
            ...prev,
            nodes: applyNodeChanges(changes, prev.nodes),
          }
        : prev
    );
    // relayer un layout léger après modif manuelle
    schedule(() => {
      if (!diagramData) return;
      if (stage !== 1) return;
      runLayout((diagramData.nodes as RFNode[]) ?? [], (diagramData.edges as RFEdge[]) ?? [], "RIGHT");
    });
  }, [diagramData, stage, runLayout]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setDiagramData(prev =>
      prev
        ? {
            ...prev,
            edges: applyEdgeChanges(changes, prev.edges),
          }
        : prev
    );
    // relayer un layout léger après modif manuelle
    schedule(() => {
      if (!diagramData) return;
      if (stage !== 1) return;
      runLayout((diagramData.nodes as RFNode[]) ?? [], (diagramData.edges as RFEdge[]) ?? [], "RIGHT");
    });
  }, [diagramData, stage, runLayout]);

  const onConnect = useCallback<NonNullable<ComponentProps<typeof ReactFlow>["onConnect"]>>((connection) => {
    setDiagramData(prev =>
      prev
        ? {
            ...prev,
            edges: addEdge(connection, prev.edges),
          }
        : prev
    );
    schedule(() => {
      if (!diagramData) return;
      if (stage !== 1) return;
      runLayout((diagramData.nodes as RFNode[]) ?? [], (diagramData.edges as RFEdge[]) ?? [], "RIGHT");
    });
  }, [diagramData, stage, runLayout]);

  /* --------------------------- Models build (Kahn) --------------------------- */

  const createModelDataStructure = () => {
    if (!diagramData) return;

    const inDegree: Record<string, number> = {};
    const graph: Record<string, string[]> = {};

    diagramData.nodes.forEach((model) => {
      inDegree[model.id] = 0;
      graph[model.id] = [];
    });

    diagramData.edges.forEach((edge) => {
      inDegree[edge.target] += 1;
      graph[edge.source].push(edge.target);
    });

    const queue: string[] = [];
    const result: string[] = [];

    Object.keys(inDegree).forEach((id) => {
      if (inDegree[id] === 0) queue.push(id);
    });

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      result.push(currentNode);
      graph[currentNode].forEach((neighbor) => {
        inDegree[neighbor] -= 1;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      });
    }

    if (result.length !== diagramData.nodes.length) {
      console.error("Il existe un cycle de dépendances!");
      return;
    }

    const orderedModels: ModelData[] = result.map((id) => ({
      id,
      name: diagramData.nodes.find((node) => node.id === id)?.data.label || "Unnamed",
      code: "",
      dependencies: diagramData.edges.filter((edge) => edge.target === id).map((edge) => edge.source),
      type: diagramData.nodes.find((node) => node.id === id)?.data.modelType || "atomic",
    }));

    setDiagramData((prev) => (prev ? { ...prev, models: orderedModels, currentModel: 0 } : prev));
  };

  /* ------------------------------- Updaters ------------------------------- */

  const updateDiagram = (newdiagramData: DiagramDataType) => {
    // deep clone pour couper toute ref partagée
    const nodes = deepClone(newdiagramData.nodes ?? []);
    const edges = deepClone(newdiagramData.edges ?? []);

    setDiagramData({
      name: newdiagramData.name ?? "Unnamed model",
      diagramId: null,
      nodes,
      edges,
      models: [],
      currentModel: 0,
    });

    setStage(1);

    // “timeout” léger façon debounce avant layout (colle à ta pratique)
    schedule(() => {
      runLayout(nodes as RFNode[], edges as RFEdge[], "RIGHT");
    }, 80);
  };

  const updateModelCode = (modelName: string, modelCode: string) => {
    setCode(modelCode);
    setDiagramData(prev => {
      if (!prev) return prev;
      const models = prev.models.map((m, idx) =>
        idx === prev.currentModel ? { ...m, name: modelName, code: modelCode } : m
      );
      return { ...prev, models };
    });
  };

  const onValidateModel = () => {
    setDiagramData(prev =>
      prev
        ? {
            ...prev,
            currentModel: prev.currentModel + 1,
            nodes: prev.nodes || [],
            edges: prev.edges || [],
            models: prev.models || [],
          }
        : prev
    );
    // TODO: save BDD ici si besoin
  };

  const onValidate = () => {
    setStage(2);
    createModelDataStructure();
    // TODO: save BDD du diagramme ici si besoin
  };

  /* -------------------------- Highlight current model -------------------------- */

  const changeHiglightedModel = useCallback(() => {
    if (!diagramData || !diagramData.models || diagramData.models.length === 0) return;

    const currentModelId = diagramData.models[diagramData.currentModel]?.id;
    if (!currentModelId) return;

    setDiagramData(prevData => {
      if (!prevData) return prevData;

      const isAlreadyHighlighted = prevData.nodes.some(
        (node) => node.id === currentModelId && node.data.isSelected === true
      );
      if (isAlreadyHighlighted) return prevData;

      const updatedNodes = prevData.nodes.map((node) => ({
        ...node,
        data: { ...node.data, isSelected: node.id === currentModelId },
      }));

      return { ...prevData, nodes: updatedNodes };
    });
  }, [diagramData]);

  const getDependencyCodes = (model: ModelData) => {
    return (
      model.dependencies
        ?.map((d) => diagramData?.models.filter((m) => m.id === d).map((m) => m.code))
        .filter((arr): arr is string[] => Array.isArray(arr))
        .flat() ?? []
    );
  };

  /* ------------------------------- Auto Save ------------------------------- */

  /* ------------------------- Layout trigger (global) ------------------------- */
  // Quand on arrive en stage 1 avec un diagramme, tenter un layout (debounced).
  useLayoutEffect(() => {
    if (!diagramData) return;
    if (stage !== 1) return;

    schedule(() => {
      runLayout((diagramData.nodes as RFNode[]) ?? [], (diagramData.edges as RFEdge[]) ?? [], "RIGHT");
    }, 80);

    // Invalider les promesses de layout obsolètes au cleanup
    return () => {
      layoutReqId.current++;
      if (layoutTimer.current) {
        window.clearTimeout(layoutTimer.current);
        layoutTimer.current = null;
      }
    };
  }, [stage, diagramData?.nodes, diagramData?.edges, runLayout]);

  /* ---------------------------------- UI ---------------------------------- */

  if (!diagramData) {
    return <p>An error occured</p>;
  }

  return (
    <div className="h-full w-full flex flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2">
        <div className="flex flex-1 items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">
                  Project Management & Task Tracking
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto px-3 flex items-center gap-2">
          {stage === 1 ? (
            <Button onClick={onValidate}>Validate diagram</Button>
          ) : null}
          <NavActions />
          <ModeToggle />
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal">
        {stage === 0 || stage === 1 ? (
          <>
            <ResizablePanel defaultSize={40} minSize={20}>
              <DiagramPrompt stage={stage} onGenerate={updateDiagram} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={60} minSize={20} onResize={() => fitView()}>
              <ReactFlow
                nodes={diagramData.nodes}
                edges={diagramData.edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                defaultEdgeOptions={defaultEdgeOptions}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                minZoom={0.1}
              >
                <MiniMap zoomable pannable />
                <Background />
                <ZoomSlider />
              </ReactFlow>
            </ResizablePanel>
          </>
        ) : null}

        {stage === 2 ? (
          <>
            <ResizablePanel defaultSize={40} minSize={20}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={60} minSize={20}>
                  <ModelPrompt
                    stage={stage}
                    onGenerate={updateModelCode}
                    previousCodes={getDependencyCodes(
                      diagramData.models[diagramData.currentModel]
                    )}
                    model={diagramData.models[diagramData.currentModel]}
                  />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={40} minSize={20} onResize={() => fitView()}>
                  <ReactFlow
                    nodes={diagramData.nodes}
                    edges={diagramData.edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    defaultEdgeOptions={defaultEdgeOptions}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    minZoom={0.1}
                  >
                    <Background />
                    <ZoomSlider />
                  </ReactFlow>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel className="relative" defaultSize={60} minSize={20}>
              <div className="h-12 w-full bg-background">
                <StepShower diagramData={diagramData} />
              </div>
              <CodeMirror
                value={code}
                className="h-full"
                onChange={(value) => setCode(value)}
                theme={theme === "dark" ? githubDark : githubLight}
                extensions={[python()]}
              />
              <Button
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 mb-4 w-auto px-4 py-2 bg-foreground text-background rounded"
                onClick={onValidateModel}
              >
                Validate model
              </Button>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
};

export default DiagramGenerator;
