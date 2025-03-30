import {AppNode, AppNodeMissingInputs} from "@/types/appNode";
import {WorkflowExecutionPlan, WorkflowExecutionPlanPhase} from "@/types/workflow";
import {Edge} from "@xyflow/react";
import {TaskRegistry} from "./task/registry";

export enum FlowToExecutionPlanValidationError {
    "NO_ENTRY_POINT",
    "INVALID_INPUTS",
}

type FlowToExecutionPlanType = {
    executionPlan?: WorkflowExecutionPlan;
    error?: {
        type: FlowToExecutionPlanValidationError;
        invalidElements?: AppNodeMissingInputs[];
    };
};

export function FlowToExecutionPlan(nodes: AppNode[], edges: Edge[]): FlowToExecutionPlanType {
    const entryPoint = nodes.find((node) => TaskRegistry[node.data.type].isEntryPoint);

    if (!entryPoint) {
        return {
            error: {
                type: FlowToExecutionPlanValidationError.NO_ENTRY_POINT,
            },
        };
    }

    const inputsWithErrors: AppNodeMissingInputs[] = [];
    const planned = new Set<string>();

    const invalidInputs = getInvalidInputs(entryPoint, edges, planned);
    if (invalidInputs.length > 0) {
        inputsWithErrors.push({
            nodeId: entryPoint.id,
            inputs: invalidInputs,
        });
    }

    const executionPlan: WorkflowExecutionPlan = [
        {
            phase: 1,
            nodes: [entryPoint],
        },
    ];

    planned.add(entryPoint.id);

    for (let phase = 2; phase <= nodes.length && planned.size < nodes.length; phase++) {
        const nextPhase: WorkflowExecutionPlanPhase = {phase, nodes: []};
        for (const currentNode of nodes) {
            if (planned.has(currentNode.id)) {
                // Node already put in the execution plan.
                continue;
            }

            const invalidInputs = getInvalidInputs(currentNode, edges, planned);
            if (invalidInputs.length > 0) {
                const incomers = getIncomers(currentNode, nodes, edges);
                if (incomers.every((incomer) => planned.has(incomer.id))) {
                    console.error("invalid input--->", currentNode.id, invalidInputs);
                    inputsWithErrors.push({
                        nodeId: currentNode.id,
                        inputs: invalidInputs,
                    });
                } else {
                    // let's skip this node for now.
                    continue;
                }
            }
            nextPhase.nodes.push(currentNode);
        }
        for (const node of nextPhase.nodes) {
            planned.add(node.id);
        }
        executionPlan.push(nextPhase);
    }

    if (inputsWithErrors.length > 0) {
        return {
            error: {
                type: FlowToExecutionPlanValidationError.INVALID_INPUTS,
                invalidElements: inputsWithErrors,
            },
        };
    }

    return {executionPlan};
}

function getInvalidInputs(node: AppNode, edges: Edge[], planned: Set<string>) {
    const invalidInputs = [];
    const inputs = TaskRegistry[node.data.type].inputs;

    for (const input of inputs) {
        const inputValue = node.data.inputs[input.name];
        const inputValueProvided = inputValue?.length > 0;

        if (inputValueProvided) {
            // This input is fine. So we can move on.
            continue;
        }

        // Check if this input is required and has a value provided by a visited node.
        // If there is an output linked to the current input.
        const incommingEdges = edges.filter((edge) => edge.target === node.id);

        const inputLinkedToOutput = incommingEdges.find((edge) => edge.targetHandle === input.name);

        const requiredInputProvidedByVisitedOutput =
            input.required && inputLinkedToOutput && planned.has(inputLinkedToOutput.source);

        if (requiredInputProvidedByVisitedOutput) {
            continue;
        } else if (!input.required) {
            if (!inputLinkedToOutput) continue;
            if (inputLinkedToOutput && planned.has(inputLinkedToOutput.source)) {
                // The output is providing a value to the input: the input is fine.
                continue;
            }
        }

        invalidInputs.push(input.name);
    }

    return invalidInputs;
}

function getIncomers(node: AppNode, nodes: AppNode[], edges: Edge[]) {
    if (!node.id) {
        return [];
    }
    const incomersIds = new Set();
    edges.forEach((edge) => {
        if (edge.target === node.id) {
            incomersIds.add(edge.source);
        }
    });
    return nodes.filter((n) => incomersIds.has(n.id));
}
