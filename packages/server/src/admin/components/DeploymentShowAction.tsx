import {
  Badge,
  Box,
  Button,
  DrawerContent,
  H3,
  Icon,
  Label,
  Loader,
  MessageBox,
  Section,
  Select,
  Text,
} from "@adminjs/design-system";
import { styled } from "@adminjs/design-system/styled-components";
import type React from "react";
import { useEffect, useState } from "react";

import {
  ActionHeader,
  type ActionProps,
  BasePropertyComponent,
  LayoutElementRenderer,
} from "adminjs";

import { ApiClient } from "adminjs";

import { Code } from "./partials/codeHighlighting.js";

const api = new ApiClient();

const CircledNumber = styled.span`
  width: 1.1rem;
  height: 1.1rem;
  line-height: 1.1rem;
  padding: 0.3rem !important;
  font-size: 1rem;

  display: inline-block;
  text-align: center;
  border: 1px solid;
  border-radius: 100%;
`;

const DeploymentShowAction: React.FC<ActionProps> = (props) => {
  const { resource, record, action } = props;
  const properties = resource.showProperties;

  const deploymentId = record?.params?.deploymentId;

  const [requirementsList, setRequirementsList] = useState<
    { name: string; status: string; message: string }[]
  >([]);
  const [requirementsStatus, setRequirementsStatus] = useState<string>("");
  const [deploymentOutput, setDeploymentOutput] =
    useState<string>("No output yet.");

  async function sendDeploymentAction(
    deploymentAction: "refresh" | "deploy" | "destroy",
  ) {
    return api.recordAction({
      recordId: record?.id as string,
      resourceId: resource.id,
      actionName: "deploy",
      params: {
        deploymentAction,
      },
    });
  }

  async function refresh() {
    // Rest at start of refresh
    setRequirementsList([]);
    setRequirementsStatus("");

    const response = await sendDeploymentAction("refresh");

    // @ts-ignore
    setRequirementsList(response.data.requirementsList);
    // @ts-ignore
    setRequirementsStatus(response.data.requirementsStatus);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    refresh();
  }, []);

  return (
    <DrawerContent>
      <H3>Deployment Data</H3>
      <details>
        <Button
          as="summary"
          variant="outlined"
          style={{ marginBottom: "1rem" }}
        >
          Show Deployment Data
        </Button>

        <Section>
          {action?.showInDrawer ? <ActionHeader {...props} /> : null}

          {action.layout
            ? action.layout.map((layoutElement, i) => (
                <LayoutElementRenderer
                  // biome-ignore lint/suspicious/noArrayIndexKey: Based on AdminJS source code
                  key={i}
                  layoutElement={layoutElement}
                  {...props}
                  where="show"
                />
              ))
            : properties.map((property) => (
                <BasePropertyComponent
                  key={property.propertyPath}
                  where="show"
                  property={property}
                  resource={resource}
                  record={record}
                />
              ))}
        </Section>
      </details>

      <Box>
        <H3>Requirements</H3>
        {requirementsList.length > 0 ? (
          <ul>
            {requirementsList.map((requirement, index) => (
              <li key={requirement.name} style={{ marginBottom: ".6rem" }}>
                <Text>
                  <CircledNumber>{index + 1}</CircledNumber>
                  &nbsp;&nbsp;
                  {requirement.name}
                  &nbsp;&nbsp;&nbsp;
                  <Badge
                    size="default"
                    variant={
                      requirement.status === "error"
                        ? "danger"
                        : requirement.status === "success"
                          ? "success"
                          : "default"
                    }
                  >
                    {requirement.status}
                  </Badge>
                </Text>
                {requirement.message && (
                  <MessageBox variant="danger">
                    {requirement.message}
                  </MessageBox>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <Text>Loading Requirements... </Text>
            <Loader />
          </div>
        )}
      </Box>

      <H3>Actions</H3>

      <Box>
        {requirementsStatus &&
          (requirementsStatus === "success" ? (
            <Text>
              <p>
                All requirements passed successfully. You can go ahead and
                deploy.{" "}
              </p>
            </Text>
          ) : (
            <Text>
              <p>
                Some requirements failed. Please review the error messages above
                and try again.
              </p>
              <p>Deployment will not be available.</p>
            </Text>
          ))}
      </Box>

      <Box style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <Button
          variant="contained"
          size="lg"
          rounded={true}
          disabled={requirementsStatus !== "success"}
          onClick={() => sendDeploymentAction("deploy")}
        >
          <Icon icon="UploadCloud" /> Deploy
        </Button>
        &nbsp; &nbsp;
        <Button variant="outlined" size="lg" rounded={true} onClick={refresh}>
          <Icon icon="RefreshCw" /> Refresh Info
        </Button>
        &nbsp; &nbsp;
        <Button
          variant="outlined"
          size="lg"
          rounded={true}
          color="danger"
          onClick={() => sendDeploymentAction("destroy")}
        >
          <Icon icon="Trash2" /> Destroy
        </Button>
      </Box>

      <Box style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <pre>
          <Code>{deploymentOutput}</Code>
        </pre>
      </Box>
    </DrawerContent>
  );
};

export default DeploymentShowAction;
