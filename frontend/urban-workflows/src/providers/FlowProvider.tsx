import React, {
    createContext,
    useState,
    useContext,
    ReactNode,
    useCallback,
    useRef,
    useEffect,
} from "react";
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    useNodesState,
    useEdgesState,
    useReactFlow,
    getOutgoers,
    MarkerType,
    applyNodeChanges,
    NodeRemoveChange
} from "reactflow";
import { ConnectionValidator } from "../ConnectionValidator";
import { BoxType, EdgeType } from "../constants";
import { useProvenanceContext } from "./ProvenanceProvider";
import { TrillGenerator } from "../TrillGenerator";
import { useLLMContext } from "./LLMProvider";

export interface IOutput {
    nodeId: string;
    output: string;
}

export interface IInteraction{
    nodeId: string;
    details: any;
    priority: number; // used to solve conflicts of interactions 1 has more priority than 0
}

// propagating interactions between pools at different resolutions
export interface IPropagation{
    nodeId: string;
    propagation: any; // {[index]: [interaction value]}
}

// applyNewOutputs = useCallback((newOutNodeId: string, newOutput: string)

interface FlowContextProps {
    nodes: Node[];
    edges: Edge[];
    workflowNameRef: React.MutableRefObject<string>;
    suggestionsLeft: number;
    workflowGoal: string;
    setWorkflowGoal: (goal: string) => void;
    setOutputs: (updateFn: (outputs: IOutput[]) => IOutput[]) => void;
    setInteractions: (updateFn: (interactions: IInteraction[]) => IInteraction[]) => void;
    applyNewPropagation: (propagation: IPropagation) => void;
    addNode: (node: Node, customWorkflowName?: string, provenance?: boolean) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection, custom_nodes?: any, custom_edges?: any, custom_workflow?: string, provenance?: boolean) => void;
    isValidConnection: (connection: Connection) => boolean;
    onEdgesDelete: (connections: Edge[]) => void;
    onNodesDelete: (changes: NodeChange[]) => void;
    setPinForDashboard: (nodeId: string, value: boolean) => void;
    setDashBoardMode: (value: boolean) => void;
    updatePositionWorkflow: (nodeId:string, position: any) => void;
    updatePositionDashboard: (nodeId:string, position: any) => void;
    applyNewOutput: (output: IOutput) => void;
    setWorkflowName: (name: string) => void;
    loadParsedTrill: (workflowName: string, task: string, node: any, edges: any, provenance?: boolean, merge?: boolean) => void;
    eraseWorkflowSuggestions: () => void;
    acceptSuggestion: (nodeId: string) => void;
    flagBasedOnKeyword: (keywordIndex?: number) => void;
    updateDataNode: (nodeId: string, newData: any) => void;
    cleanCanvas: () => void;
    updateSubtasks: (trill: any) => void;
    updateKeywords: (trill: any) => void;
    updateDefaultCode: (nodeId: string, content: string) => void;
    updateWarnings: (trill_spec: any) => void;
}

export const FlowContext = createContext<FlowContextProps>({
    nodes: [],
    edges: [],
    workflowNameRef: { current: "" },
    suggestionsLeft: 0,
    workflowGoal: "",
    setWorkflowGoal: () => {},
    setOutputs: () => { },
    setInteractions: () => {},
    applyNewPropagation: () => {},
    addNode: () => { },
    onNodesChange: () => { },
    onEdgesChange: () => { },
    onConnect: () => { },
    isValidConnection: () => true,
    onEdgesDelete: () => {},
    onNodesDelete: () => {},
    setPinForDashboard: () => {},
    setDashBoardMode: () => {},
    updatePositionWorkflow: () => {},
    updatePositionDashboard: () => {},
    applyNewOutput: () => {},
    setWorkflowName: () => {},
    loadParsedTrill: async () => {},
    eraseWorkflowSuggestions: () => {},
    acceptSuggestion: () => {},
    flagBasedOnKeyword: () => {},
    updateDataNode: () => {},
    cleanCanvas: () => {},
    updateSubtasks: () => {},
    updateKeywords: () => {},
    updateDefaultCode: () => {},
    updateWarnings: () => {}
});

const FlowProvider = ({ children }: { children: ReactNode }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [outputs, setOutputs] = useState<IOutput[]>([]);
    const [interactions, setInteractions] = useState<IInteraction[]>([]);
    const [dashboardPins, setDashboardPins] = useState<any>({}); // {[nodeId] -> boolean}
    const [suggestionsLeft, setSuggestionsLeft] = useState<number>(0); // Number of suggestions left
    // const [workflowGoal, setWorkflowGoal] = useState("Load 311 request data from a CSV file, analyze trends in the number of requests over time, categorize requests by type to identify common issues, and visualize the findings using a line chart for trends, a bar chart for request types, and a geographic map for request locations.");
    const [workflowGoal, setWorkflowGoal] = useState("");

    const [positionsInDashboard, _setPositionsInDashboard] = useState<any>({}); // [nodeId] -> change
    const positionsInDashboardRef = useRef(positionsInDashboard);
    const setPositionsInDashboard = (data: any) => {
        positionsInDashboardRef.current = data;
        _setPositionsInDashboard(data);
    };

    const [positionsInWorkflow, _setPositionsInWorkflow] = useState<any>({}); // [nodeId] -> change
    const positionsInWorkflowRef = useRef(positionsInWorkflow);
    const setPositionsInWorkflow = (data: any) => {
        positionsInWorkflowRef.current = data;
        _setPositionsInWorkflow(data);
    };

    const reactFlow = useReactFlow();
    const { newBox, addWorkflow, deleteBox, newConnection, deleteConnection } = useProvenanceContext();

    // const [workflowName, setWorkflowName] = useState<string>("DefaultWorkflow");
  
    const [workflowName, _setWorkflowName] = useState<string>("DefaultWorkflow"); 
    const workflowNameRef = React.useRef(workflowName);
    const setWorkflowName = (data: any) => {
        workflowNameRef.current = data;
        _setWorkflowName(data);
    };

    useEffect(() => {
        addWorkflow(workflowNameRef.current);
        let empty_trill = TrillGenerator.generateTrill([], [], workflowNameRef.current, workflowGoal);
        TrillGenerator.intializeProvenance(empty_trill);
    }, [])

    const updateDataNode = (nodeId: string, newData: any) => {
        let copy_newData = {...newData};

        console.log("updateDataNode");

        setNodes(prevNodes => {

            let newNodes = [];

            for(const node of prevNodes){
                let newNode = {...node};

                if(newNode.id == nodeId)
                    newNode.data = copy_newData;
            
                newNodes.push(newNode);
            }

            return [...newNodes];
        });
    }

    const loadParsedTrill = async (workflowName: string, task: string, loaded_nodes: any, loaded_edges: any, provenance?: boolean, merge?: boolean) => {

        // setWorkflowGoal(task);

        if(!merge){
            setWorkflowName(workflowName);
            await addWorkflow(workflowName); // reseting provenance with new workflow
            console.log("loadParsedTrill reseting nodes")
            setNodes(prevNodes => []); // Reseting nodes
        }

        let current_nodes_ids = [];

        if(merge){
            for(const node of nodes){
                current_nodes_ids.push(node.id);
            }
    
            for(const node of loaded_nodes){ // adding new nodes one by one
                if(!current_nodes_ids.includes(node.id)){ // if the node already exist do not include it again
                    addNode(node, workflowName, provenance);
                }
            }
        }else{
            for(const node of loaded_nodes){ // adding new nodes one by one
                addNode(node, workflowName, provenance);
            }
        }

        if(!merge){
            // onEdgesDelete(edges);
            setEdges(prevEdges => []) // Reseting edges
        }

        let current_edges_ids = [];

        for(const edge of edges){
            current_edges_ids.push(edge.id);
        }

        console.log("loadParsedTrill second");
        setNodes((prevNodes: any) => { // Guarantee that previous nodes were added
            
            if(merge){
                for(const edge of loaded_edges){
                    if(!current_edges_ids.includes(edge.id)){ // if the edge already exist do not include it again
                        onConnect(edge, prevNodes, undefined, workflowName, provenance);
                    }
                }
            }else{
                for(const edge of loaded_edges){
                    onConnect(edge, prevNodes, undefined, workflowName, provenance);
                }
            }

    
            if(!merge){
                setOutputs([]);
                setInteractions([]);
                setDashboardPins({});
                setPositionsInDashboard({});
                setPositionsInWorkflow({});
            }

            return prevNodes;
        })

        // TODO: Unset dashboardMode (setDashBoardMode)
    }

    const updateDefaultCode = (nodeId: string, content: string) => {
        console.log("updateDefaultCode");
        setNodes(prevNodes => {

            let newNodes = [];

            for(const node of prevNodes){
                let newNode = {...node};

                if(node.id == nodeId){
                    node.data.defaultCode = content;
                }

                newNodes.push(newNode);
            }

            return newNodes;
        });
    }

    const updateKeywords = (trill_spec: any) => { // Given a trill specification with nodes and edges with the same IDs as the current nodes and edges attach the keywords.

        let node_to_keywords: any = {};
        let edge_to_keywords: any = {};

        if(trill_spec.dataflow != undefined){
            for(const node of trill_spec.dataflow.nodes){
                if(node.metadata != undefined && node.metadata.keywords != undefined){
                    node_to_keywords[node.id] = [...node.metadata.keywords];
                }
            }

            for(const edge of trill_spec.dataflow.edges){
                if(edge.metadata != undefined && edge.metadata.keywords != undefined){
                    edge_to_keywords[edge.id] = [...edge.metadata.keywords];
                } 
            }
        }

        console.log("updateKeywords");
        setNodes(prevNodes => {

            let newNodes = [];

            for(const node of prevNodes){
                let newNode = {...node};

                if(node_to_keywords[newNode.id] != undefined)
                    newNode.data.keywords = node_to_keywords[newNode.id]

                newNodes.push(newNode);
            }

            return newNodes;
        });

        setEdges(prevEdges => {

            let newEdges = [];

            for(const edge of prevEdges){
                let newEdge = {...edge};

                if(edge_to_keywords[newEdge.id] != undefined)
                    newEdge.data.keywords = edge_to_keywords[newEdge.id]

                newEdges.push(newEdge);
            }

            return newEdges;
        });

    }

    const updateSubtasks = (trill_spec: any) => { // Given a trill specification update the nodes subtasks
       
        let node_to_goal: any = {};

        if(trill_spec.dataflow != undefined){
            for(const node of trill_spec.dataflow.nodes){
                if(node.goal != undefined){
                    node_to_goal[node.id] = node.goal;
                }
            }
        }

        console.log("updateSubtasks");
        setNodes(prevNodes => {

            let newNodes = [];

            for(const node of prevNodes){
                let newNode = {...node};

                if(node_to_goal[newNode.id] != undefined)
                    newNode.data.goal = node_to_goal[newNode.id]

                newNodes.push(newNode);
            }

            return newNodes;
        });

    }

    const updateWarnings = (trill_spec: any) => { // Given a trill specification update the nodes warnings

        let node_to_warning: any = {};

        if(trill_spec.dataflow != undefined){
            for(const node of trill_spec.dataflow.nodes){
                if(node.warnings != undefined){
                    node_to_warning[node.id] = node.warnings;
                }
            }
        }

        console.log("updateWarnings");
        setNodes(prevNodes => {

            let newNodes = [];

            for(const node of prevNodes){
                let newNode = {...node};

                if(node_to_warning[newNode.id] != undefined)
                    newNode.data.warnings = node_to_warning[newNode.id]

                newNodes.push(newNode);
            }

            return newNodes;
        });

    }

    const cleanCanvas = () => {

        let edgesWithProvenance = [];

        for(const edge of edges){
            if((edge.data && !(edge.data.suggestionType != "none" && edge.data.suggestionType != undefined)) || !edge.data)
                edgesWithProvenance.push(edge);
        }

        onEdgesDelete(edgesWithProvenance); // deleting provenance of non-suggestions

        setEdges(prevNodes => []);

        for(const node of nodes){
            if((node.data && !(node.data.suggestionType != "none" && node.data.suggestionType != undefined)) || !node.data) // not a suggestion have to erase provenance
                deleteNode(node.id);

        }

        console.log("cleanCanvas");
        setNodes(prevNodes => []);

        setOutputs([]);
        setInteractions([]);
        setDashboardPins({});
        setPositionsInDashboard({});
        setPositionsInWorkflow({});
 
        setSuggestionsLeft(0);

    }

    // Go through all suggestions and flag the nodes that do not dependent on any other node in workflow suggestions
    const flagAcceptableSuggestions = (nodes: any, edges: any) => {
        
        let dependOn = []; // all nodes that depend on some other node suggested node
        let suggestedNodes = []; // all ids of suggested nodes

        for(const node of nodes){
            if(node.data.suggestionType == "workflow"){
                suggestedNodes.push(node.id);
            }
        }

        setSuggestionsLeft(suggestedNodes.length); // Updating number of suggestions left

        for(const edge of edges){
            if(suggestedNodes.includes(edge.source)) // The node depends on some other suggested node
                dependOn.push(edge.target);
        }

        let nodesToUpdate = []; // Which nodes need to have their suggestionAcceptable flag flipped

        for(const node of nodes){
            if(!dependOn.includes(node.id) && node.data.suggestionType == "workflow"){ // It means that the node can be accepted as a suggestion
                if(!node.data.suggestionAcceptable) // Check if the flag needs to be flipped
                    nodesToUpdate.push(node.id);
            }else if(node.data.suggestionType == "connection"){ // Connection suggestions does not care about dependencies
                if(!node.data.suggestionAcceptable) // Check if the flag needs to be flipped
                    nodesToUpdate.push(node.id);
            }else{
                if(node.data.suggestionAcceptable) // Check if the flag needs to be flipped
                    nodesToUpdate.push(node.id);
            }
        }

        if(nodesToUpdate.length > 0){

            console.log("flagAcceptableSuggestions");
            setNodes(prevNodes => {
                let newNodes = [];
    
                for(const node of prevNodes){
                    let newNode = {...node};

                    if(nodesToUpdate.includes(newNode.id))
                        newNode.data.suggestionAcceptable = !newNode.data.suggestionAcceptable; // flip the flag

                    newNodes.push(newNode);
                }
    
                return newNodes;
            });
        }

    }

    // Accept the suggestion for adding a specific node
    const acceptSuggestion = (nodeId: string) => {

        console.log("acceptSuggestion");
        setNodes(prevNodes => {
            let newNodes = [];
            let suggestions = []; // ids of all suggestion nodes
            let acceptedConnectionSuggestion = false; // if a connection suggestion is accepted all others are canceled
            let acceptedConnectionSuggestionId = "";

            for(const node of prevNodes){

                let newNode = {...node};

                if(newNode.id == nodeId){
                    newNode.data.suggestionAcceptable = false;

                    if(newNode.data.suggestionType == "connection"){
                        acceptedConnectionSuggestion = true;
                        acceptedConnectionSuggestionId = newNode.id;
                    }

                    newNode.data.suggestionType = "none";

                    newBox(workflowNameRef.current, (newNode.type as string) + "-" + newNode.id); // Provenance of the accepted suggestion
                }

                newNodes.push(newNode);
            }
    
            let filteredNewNodes = newNodes.filter((node) => { // if acceptedConnectionSuggestion remove the other connection suggestions
                return !(node.data.suggestionType == "connection" && acceptedConnectionSuggestion)
            }); 

            for(const node of filteredNewNodes){
                if(node.data.suggestionType != "none" && node.data.suggestionType != undefined) // it is a suggestion
                    suggestions.push(node.id);
            }

            setEdges(prevEdges => {
                let newEdges = [];

                for(const edge of prevEdges){
                    let newEdge = {...edge};

                    if(!(acceptedConnectionSuggestion && newEdge.data.suggestionType == "connection") || (acceptedConnectionSuggestionId == newEdge.source || acceptedConnectionSuggestionId == newEdge.target)){ // if a connection suggestion was accepted only maintain the edge that connects the suggestion
                        if(!suggestions.includes(edge.source) && !suggestions.includes(edge.target)) // if the source and target of an edge is not suggestion, the edge is not suggestion anymore
                            newEdge.data.suggestionType = "none";
    
                        newEdges.push(newEdge);
                    }

                }

                return newEdges;
            })

            return filteredNewNodes;
        });

    }

    // If keywordIndex is undefied all components are unflagged
    const flagBasedOnKeyword = (keywordIndex?: number) => {
        console.log("flagBasedOnKeyword");
        setNodes(prevNodes => {
            let newNodes = [];

            for(const node of prevNodes){
                let newNode = {...node};

                if(newNode.data.keywords != undefined && keywordIndex != undefined && newNode.data.keywords.includes(keywordIndex))
                    newNode.data.keywordHighlighted = true;
                else
                    newNode.data.keywordHighlighted = false;

                newNodes.push(newNode);
            }

            return newNodes;
        });
    
        setEdges(prevEdges =>
            prevEdges.map(edge => ({
              ...edge,
              data: {
                ...edge.data,
                keywordHighlighted:
                  edge.data.keywords !== undefined &&
                  keywordIndex !== undefined &&
                  edge.data.keywords.includes(keywordIndex),
              },
            }))
          );

    }

    useEffect(() => {
        flagAcceptableSuggestions(nodes, edges);
    }, [nodes, edges]);

    // Erase all nodes and edges that are suggestions if the use added a node or an edge
    const eraseWorkflowSuggestions = () => {
        
        setEdges(prevEdges => {
            let newEdges = [];

            for(const edge of prevEdges){
                if(edge.data.suggestionType != "workflow"){
                    newEdges.push({...edge});
                }
            }

            return newEdges;
        });

        setEdges((prevEdges: any) => { // Making sure that the removal of nodes happen after the removal of nodes
            console.log("eraseWorkflowSuggestions");
            setNodes((prevNodes: any) => {
                let newNodes = [];
    
                for(const node of prevNodes){
                    if(node.data.suggestionType != "workflow"){
                        let copy_node = {...node};
                        copy_node.data.suggestionAcceptable = false; // The node is not a suggestion. Reseting the flag.

                        newNodes.push({...copy_node});
                    }
                }
    
                return newNodes;
            });

            return prevEdges;
        });

        setSuggestionsLeft(0);
    }

    const setDashBoardMode = (value: boolean) => {

        // setNodes((nds: any) => 
        //     nds.map((node: any) => {
        //         if(dashboardPins[node.id] == true){
        //             node.data = {
        //                 ...node.data,
        //                 hidden: false
        //             };         
        //         }else{
        //             node.data = {
        //                 ...node.data,
        //                 hidden: value
        //             };    
        //         }

        //         // Detect nodes by having the class react-flow__node
        //         // The node id is in the attribute data-id

        //         let position = {...node.position};

        //         if(value){
        //             if(positionsInDashboardRef.current[node.id] != undefined){
        //                 position = {...positionsInDashboardRef.current[node.id]};
        //             }
        //         }else{
        //             if(positionsInWorkflowRef.current[node.id] != undefined){
        //                 position = {...positionsInWorkflowRef.current[node.id]};
        //             }
        //         }

        //         return {
        //             ...node, 
        //             position
        //         };
        //     })
        // );

        const nodesDiv = document.querySelectorAll('.react-flow__node');

        // Hide each element
        nodesDiv.forEach(element => {
            if(value){

                // @ts-ignore
                if(!dashboardPins[element.getAttribute('data-id')]){
                    // @ts-ignore
                    element.style.display = 'none';
                }else{
                    // @ts-ignore
                    element.style.display = 'block';

                    // @ts-ignore
                    if(positionsInDashboardRef.current[element.getAttribute('data-id')] != undefined){
                        setNodes((oldNodes) => {
                            // @ts-ignore
                            console.log(positionsInDashboardRef.current[element.getAttribute('data-id')]);
                            // @ts-ignore
                            return applyNodeChanges([positionsInDashboardRef.current[element.getAttribute('data-id')]], oldNodes)
                        });
                    }
                }
            }else{
                // @ts-ignore
                element.style.display = 'block';

                // @ts-ignore
                if(positionsInWorkflowRef.current[element.getAttribute('data-id')] != undefined){
                    // @ts-ignore
                    console.log(positionsInWorkflowRef.current[element.getAttribute('data-id')]);
                    // @ts-ignore
                    setNodes((oldNodes) => applyNodeChanges([positionsInWorkflowRef.current[element.getAttribute('data-id')]], oldNodes));
                }
            }
        });

        const edgesPath = document.querySelectorAll('.react-flow__edge-path');

        // Hide each element
        edgesPath.forEach(element => {
            if(value){
                // @ts-ignore
                element.style.display = 'none';
            }else{
                // @ts-ignore
                element.style.display = 'block';
            }
        });

        const edgesInteraction = document.querySelectorAll('.react-flow__edge-interaction');

        // Hide each element
        edgesInteraction.forEach(element => {
            if(value){
                // @ts-ignore
                element.style.display = 'none';
            }else{
                // @ts-ignore
                element.style.display = 'block';
            }
        });
    }

    const updatePositionWorkflow = (nodeId:string, change: any) => {
        setPositionsInWorkflow({
            ...positionsInWorkflowRef.current,
            [nodeId]: {...change}
        })
    }

    const updatePositionDashboard = (nodeId:string, change: any) => {
        setPositionsInDashboard({
            ...positionsInDashboardRef.current,
            [nodeId]: {...change}
        });
    }

    // TODO: implement listener for position changes in nodes. 

    const setPinForDashboard = (nodeId: string, value: boolean) => {
        let newDashboardPins: any = {};
        let nodesIds = Object.keys(dashboardPins);
        
        for(const id of nodesIds){
            newDashboardPins[id] = dashboardPins[id];
        }

        newDashboardPins[nodeId] = value;

        setDashboardPins(newDashboardPins);
    }

    const addNode = useCallback(
        (node: Node, customWorkflowName?: string, provenance?: boolean) => {
            console.log("add node");
            setNodes((prev: any) => {
                node.position
                updatePositionWorkflow(node.id, {
                    id: node.id,
                    dragging: true,
                    position: {...node.position},
                    positionAbsolute: {...node.position},
                    type: "position"
                });
                return prev.concat(node)
            });
            
            if(provenance) // If there should be provenance tracking
                newBox((customWorkflowName ? customWorkflowName : workflowNameRef.current), (node.type as string) + "-" + node.id);
        },
        [setNodes]
    );

    // updates a single box with the new input (new connections)
    const applyOutput = (inBox: BoxType, inId: string, outId: string, sourceHandle: string, targetHandle: string) => {
        
        if(sourceHandle == "in/out" && targetHandle == "in/out")
            return

        let getOutput = outId;
        let setInput = inId;

        let output = "";

        setOutputs((opts: any) => 
            opts.map((opt: any) => {

                if(opt.nodeId == getOutput){
                    output = opt.output;
                }

                return opt;
            })
        );

        console.log("applyOutput");
        setNodes((nds: any) => 
            nds.map((node: any) => {

                if(node.id == setInput){

                    // Merge Flow box is the only box that allows multiple 'in' connections
                    if(inBox == BoxType.MERGE_FLOW){
                        let inputList = node.data.input;
                        let sourceList = node.data.source;

                        if(inputList == undefined || inputList == ""){
                            inputList = [output];
                        }else{
                            inputList = [...inputList, output];
                        }

                        if(sourceList == undefined || sourceList == ""){
                            sourceList = [getOutput];
                        }else{
                            sourceList = [...sourceList, getOutput];
                        }

                        node.data = {
                            ...node.data,
                            input: inputList,
                            source: sourceList
                        };

                    }else{
                        node.data = {
                            ...node.data,
                            input: output,
                            source: getOutput
                        };
                    }
                }

                return node;
            })
        );

    }

    const onEdgesDelete = useCallback((connections: Edge[]) => {

        for(const connection of connections){

            let resetInput = connection.target;
            let targetNode = reactFlow.getNode(connection.target) as Node;

            // skiping syncronized connections
            if(connection.sourceHandle != "in/out" && connection.targetHandle != "in/out"){
                deleteConnection(workflowNameRef.current, targetNode.id, targetNode.type as BoxType);
            }

            // skiping syncronized connections
            if(connection.sourceHandle != "in/out" || connection.targetHandle != "in/out"){
                console.log("onEdgesDelete");
                setNodes((nds: any) => 
                    nds.map((node: any) => {
        
                        if(node.id == resetInput){
                            if(targetNode.type = BoxType.MERGE_FLOW){
                                let inputList: string[] = [];
                                let sourceList: string[] = [];

                                if(Array.isArray(node.data.source)){
                                    for(let i = 0; i < node.data.source.length; i++){
                                        if(connection.source != node.data.source[i]){
                                            inputList.push(node.data.input[i]);
                                            sourceList.push(node.data.source[i]);
                                        }
                                    }
                                }

                                node.data = {
                                    ...node.data,
                                    input: inputList,
                                    source: sourceList
                                };
                            }else{
                                node.data = {
                                    ...node.data,
                                    input: "",
                                    source: ""
                                };
                            }

                        }
        
                        return node;
                    })
                );
            }
        }

    }, [setNodes]);

    // Considering provenance
    const deleteNode = (nodeId: string) => {
        const change: NodeRemoveChange = {
            id: nodeId,
            type: "remove",
        };

        onNodesDelete([change]);
    };

    const onNodesDelete = useCallback((changes: NodeChange[]) => {
        setOutputs((opts: any) => 
            opts.filter((opt: any) => {
                for(const change of changes){
                    // @ts-ignore
                    if(opt.nodeId == change.id && change.type == "remove"){ // node was removed
                        return false;
                    }
                }

                return true;
            })
        );

        for(const change of changes){
            if(change.type == "remove"){
                let node = reactFlow.getNode(change.id) as Node;
                deleteBox(workflowNameRef.current, node.type+"-"+node.id);
            }
        }

    }, [setOutputs]);

    const onConnect = useCallback(
        (connection: Connection, custom_nodes?: any, custom_edges?: any, custom_workflow?: string, provenance?: boolean) => {
            const nodes = custom_nodes ? custom_nodes : getNodes();
            const edges = custom_edges ? custom_edges : getEdges();

            const target = nodes.find(
                (node: any) => node.id === connection.target
            ) as Node;
            const hasCycle = (node: Node, visited = new Set()) => {
                if (visited.has(node.id)) return false;

                visited.add(node.id);

                for (const outgoer of getOutgoers(node, nodes, edges)) {
                    if (outgoer.id === connection.source) return true;
                    if (hasCycle(outgoer, visited)) return true;
                }
            };

            let validHandleCombination = true;

            if ((connection.sourceHandle == "in/out" && connection.targetHandle != "in/out") || (connection.targetHandle == "in/out" && connection.sourceHandle != "in/out")) {
                validHandleCombination = false;
                alert("An in/out connection can only be connected to another in/out connection");
            }else if((connection.sourceHandle == "in" && connection.targetHandle != "out") || (connection.targetHandle == "in" && connection.sourceHandle != "out")){
                validHandleCombination = false;
                alert("An in connection can only be connected to an out connection");
            }else if((connection.sourceHandle == "out" && connection.targetHandle != "in") || (connection.targetHandle == "out" && connection.sourceHandle != "in")){
                validHandleCombination = false;
                alert("An out connection can only be connected to an in connection");
            }

            if (validHandleCombination) {
                // Check compatibility between inputs and outputs
                let inBox: BoxType | undefined = undefined;
                let outBox: BoxType | undefined = undefined;

                for (const elem of nodes) {
                    if (elem.id == connection.source) {
                        outBox = elem.type as BoxType;
                    }

                    if (elem.id == connection.target) {
                        inBox = elem.type as BoxType;
                    }
                }

                let allowConnection = ConnectionValidator.checkBoxCompatibility(
                    outBox,
                    inBox
                );

                if (!allowConnection)
                    alert("Input and output types of these boxes are not compatible");

                // Checking cycles
                if (target.id === connection.source) {
                    alert("Cycles are not allowed");
                    allowConnection = false;
                }

                if (hasCycle(target)) {
                    alert("Cycles are not allowed");
                    allowConnection = false;
                }

                if (allowConnection){
                    applyOutput(inBox as BoxType, connection.target as string, connection.source as string, connection.sourceHandle as string, connection.targetHandle as string);

                    setEdges((eds) => {

                        let customConnection: any = {
                            ...connection,
                            markerEnd: {type: MarkerType.Arrow}
                        };

                        if(customConnection.data == undefined)
                            customConnection.data = {};

                        if(connection.sourceHandle == "in/out" && connection.targetHandle == "in/out"){
                            customConnection.markerStart = {type: MarkerType.Arrow};
                            customConnection.type = EdgeType.BIDIRECTIONAL_EDGE;
                        }else{ // only do provenance for in and out connections

                            customConnection.type = EdgeType.UNIDIRECTIONAL_EDGE;

                            if(provenance)  
                                newConnection((custom_workflow ? custom_workflow : workflowNameRef.current), customConnection.source, outBox as BoxType, customConnection.target, inBox as BoxType);
                        }

                        return addEdge(customConnection, eds)
                    });
                } 
            }

        },
        [setEdges]
    );

    const { getNodes, getEdges } = useReactFlow();

    // Checking for cycles and invalid connections between types of boxes
    const isValidConnection = useCallback(
        (connection: Connection) => {
            return true;
        },
        [getNodes, getEdges]
    );

    // a box generated a new output. Propagate it to directly connected boxes
    const applyNewOutput = (newOutput: IOutput) => {

        let nodesAffected: string[] = [];

        let edges = reactFlow.getEdges();

        for (let i = 0; i < edges.length; i++) {

            let targetId = edges[i].target;
            let sourceId = edges[i].source;

            if(edges[i].sourceHandle == "in/out" && edges[i].targetHandle == "in/out"){ // in 'in/out' connection a DATA_POOL is always some of the ends
                continue;
            }

            if(newOutput.nodeId == sourceId){ // directly affected by new output
                nodesAffected.push(targetId);
            }
        }

        console.log("applyNewOutput");
        setNodes((nds: any) => 
            nds.map((node: any) => {

                if(nodesAffected.includes(node.id)){
                    if(node.type == BoxType.MERGE_FLOW){
                        
                        if(Array.isArray(node.data.input)){

                            let foundSource = false;
                            let inputList: string[] = [];
                            let sourceList: string[] = [];

                            for(let i = 0; i < node.data.input.length; i++){
                                if(node.data.source[i] == newOutput.nodeId){ // updating new value
                                    inputList.push(newOutput.output);
                                    sourceList.push(newOutput.nodeId);
                                    foundSource = true;
                                }else{
                                    inputList.push(node.data.input[i]);
                                    sourceList.push(node.data.source[i]);
                                }
                            }

                            if(!foundSource){ // adding new value
                                inputList.push(newOutput.output);
                                sourceList.push(newOutput.nodeId);
                            }

                            node.data = {
                                ...node.data,
                                input: inputList,
                                source: sourceList
                            };
                        }else{
                            node.data = {
                                ...node.data,
                                input: [newOutput.output],
                                source: [newOutput.nodeId]
                            };
                        }

                    }else{
                        if(newOutput.output == undefined){
                            node.data = {
                                ...node.data,
                                input: "",
                                source: ""
                            };
                        }else{
                            node.data = {
                                ...node.data,
                                input: newOutput.output,
                                source: newOutput.nodeId
                            };
                        }
                    }
                }

                return node;
            })
        );

        setOutputs((opts: any) => {

            let added = false;

            let newOpts = opts.map((opt: any) => {

                if(opt.nodeId == newOutput.nodeId){
                    added = true;
                    return {
                        ...opt,
                        output: newOutput.output
                    }
                }

                return opt;
            });

            if(!added)
                newOpts.push({...newOutput});

            return newOpts;
        });

    };

    // responsible for flow of already connected
    const applyNewInteractions = useCallback(() => {

        let newInteractions = interactions.filter((interaction) => {return interaction.priority == 1}); //priority == 1 means that this is a new or updated interaction 

        let toSend: any = {}; // {nodeId -> {type: VisInteractionType, data: any}}
        let interactedIds: string[] = newInteractions.map((interaction: IInteraction) => {return interaction.nodeId});
        let poolsIds: string[] = [];

        let interactionDict: any = {};

        for(const interaction of newInteractions){
            interactionDict[interaction.nodeId] = {details: interaction.details, priority: interaction.priority};
        }

        for(let i = 0; i < nodes.length; i++){
            if(nodes[i].type == BoxType.DATA_POOL){
                poolsIds.push(nodes[i].id);
            }
        }

        for(let i = 0; i < edges.length; i++){

            let targetNode = reactFlow.getNode(edges[i].target) as Node;
            let sourceNode = reactFlow.getNode(edges[i].source) as Node;

            if(edges[i].sourceHandle == "in/out" && edges[i].targetHandle == "in/out" && !(targetNode.type == BoxType.DATA_POOL && sourceNode.type == BoxType.DATA_POOL)){
                if(interactedIds.includes(edges[i].source) && poolsIds.includes(edges[i].target)){ // then the target is the pool
                    
                    if(toSend[edges[i].target] == undefined){
                        toSend[edges[i].target] = [interactionDict[edges[i].source]];
                    }else{
                        toSend[edges[i].target].push(interactionDict[edges[i].source])
                    }
                }else if(interactedIds.includes(edges[i].target) && poolsIds.includes(edges[i].source)){ // then the source is the pool
                    if(toSend[edges[i].source] == undefined){
                        toSend[edges[i].source] = [interactionDict[edges[i].target]];
                    }else{
                        toSend[edges[i].source].push(interactionDict[edges[i].target])
                    }
                }
            }
        }

        console.log("applyNewInteractions");
        setNodes((nds: any) => 
            nds.map((node: any) => {

                if(toSend[node.id] != undefined){

                    node.data = {
                        ...node.data,
                        interactions: toSend[node.id]
                    }
                }
               
                return node;
            })
        );

    }, [interactions]);

    // propagations only happen with in/out
    const applyNewPropagation = useCallback((propagationObj: IPropagation) => {

        let sendTo: string[] = [];

        let edges = reactFlow.getEdges();

        for(const edge of edges){
            if(edge.target == propagationObj.nodeId || edge.source == propagationObj.nodeId){ // if one of the extremities of the edge is responsible for the propagation
                let targetNode = reactFlow.getNode(edge.target) as Node;
                let sourceNode = reactFlow.getNode(edge.source) as Node;
    
                if(edge.sourceHandle == "in/out" && edge.targetHandle == "in/out" && targetNode.type == BoxType.DATA_POOL && sourceNode.type == BoxType.DATA_POOL){
                    if(edge.target != propagationObj.nodeId){
                        sendTo.push(edge.target);    
                    }

                    if(edge.source != propagationObj.nodeId){
                        sendTo.push(edge.source);    
                    }
                }
            }
        }

        console.log("applyNewPropagation");
        setNodes((nds: any) => 
            nds.map((node: any) => {

                if(sendTo.includes(node.id)){

                    let newPropagation = true;
                    if(node.data.newPropagation != undefined){
                        newPropagation = !node.data.newPropagation;
                    }

                    node.data = {
                        ...node.data,
                        propagation: {...propagationObj.propagation},
                        newPropagation: newPropagation
                    }
                }else{
                    node.data = {
                        ...node.data,
                        propagation: undefined
                    }
                }

                return node;
            })
        );

    }, []);

    useEffect(() => {
        applyNewInteractions();
    }, [interactions]);

    return (
        <FlowContext.Provider
            value={{
                nodes,
                edges,
                workflowNameRef,
                suggestionsLeft,
                workflowGoal,
                setWorkflowGoal,
                setOutputs,
                setInteractions,
                applyNewPropagation,
                addNode,
                onNodesChange,
                onEdgesChange,
                onConnect,
                isValidConnection,
                onEdgesDelete,
                onNodesDelete,
                setPinForDashboard,
                setDashBoardMode,
                updatePositionWorkflow,
                updatePositionDashboard,
                applyNewOutput,
                setWorkflowName,
                loadParsedTrill,
                eraseWorkflowSuggestions,
                acceptSuggestion,
                flagBasedOnKeyword,
                updateDataNode,
                cleanCanvas,
                updateSubtasks,
                updateKeywords,
                updateWarnings,
                updateDefaultCode
            }}
        >
            {children}
        </FlowContext.Provider>
    );
};

export const useFlowContext = () => {
    const context = useContext(FlowContext);

    if (!context) {
        throw new Error("useFlowContext must be used within a FlowProvider");
    }

    return context;
};

export default FlowProvider;
