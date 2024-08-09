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

const BadgeIcon = styled(Icon)`
  margin: 0 0.1rem 0 -0.3rem !important;
  transform: scale(0.8);
  line-height: 0.7;
`;

const DeploymentShowAction: React.FC<ActionProps> = (props) => {
  const { resource, record, action } = props;
  const properties = resource.showProperties;

  const deploymentId = record?.params?.deploymentId;

  const [currentActivity, setCurrentActivity] = useState<
    "none" | "requirements" | "refresh" | "preview" | "deploy" | "destroy"
  >("none");
  const [errorMessage, setErrorMessage] = useState<
    { type: string; message: string } | undefined
  >(undefined);
  const [requirementsList, setRequirementsList] = useState<
    {
      name: string;
      status: string;
      message: string;
      errorMessage?: string;
      url?: string;
    }[]
  >([]);
  const [requirementsStatus, setRequirementsStatus] = useState<string>("");
  const [deploymentOutput, setDeploymentOutput] =
    useState<string>("No output yet.");

  async function sendDeploymentAction(
    deploymentAction:
      | "requirements"
      | "refresh"
      | "preview"
      | "deploy"
      | "destroy",
  ) {
    // Reset error
    setErrorMessage(undefined);
    setCurrentActivity(deploymentAction);

    try {
      const response = await api.recordAction({
        recordId: record?.id as string,
        resourceId: resource.id,
        actionName: "deploy",
        params: {
          deploymentAction,
        },
      });

      // Standard Deployment output
      if (response.data.result) {
        const result = response.data.result;
        setDeploymentOutput(
          `STDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`,
        );
      } else if (response.data.notice?.type === "error") {
        setErrorMessage({
          type: "Server Error",
          message: response.data.notice.message,
        });
      } else {
        setErrorMessage({
          type: "No Result",
          message: `No result was returned from the server. Response Data: ${response.data}`,
        });
      }

      setCurrentActivity("none");

      return response;

      // Not the nicest solution typewise, but this can also be an AxiosError with extra info
    } catch (err: any) {
      const error = {
        type: err.name || "Unknown Error",
        message: err.message || "An unknown error occurred.",
      };

      // Server error detected, so use the information from there
      if (err.response.data.error) {
        if (err.response.data.type) error.type = err.response.data.type;
        error.message = err.response.data.error;
      }

      setErrorMessage(error);
      setCurrentActivity("none");
      return;
    }
  }

  async function checkRequirements() {
    // Rest at start of refresh
    setRequirementsList([]);
    setRequirementsStatus("");

    const response = await sendDeploymentAction("requirements");
    if (!response || !response.data || !response.data.requirementsList) {
      if (!errorMessage) {
        setErrorMessage({
          type: "NoRequirementListReturned",
          message: "No requirementsList was returned from the server",
        });
      }
      return;
    }

    setRequirementsList(response.data.requirementsList);
    setRequirementsStatus(response.data.requirementsStatus);
  }

  async function refresh() {
    // First check requirements
    await checkRequirements();
    // Then run the pulumi refresh
    await sendDeploymentAction("refresh");
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

      {errorMessage && (
        <MessageBox
          variant="danger"
          mt="default"
          message={`An Error was encountered: ${errorMessage.type}`}
        >
          <Text>{errorMessage.message}</Text>
        </MessageBox>
      )}

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
                    <BadgeIcon
                      icon={
                        requirement.status === "error"
                          ? "XCircle"
                          : requirement.status === "success"
                            ? "CheckCircle"
                            : "Circle"
                      }
                    />

                    {requirement.status}
                  </Badge>
                  {requirement.url && (
                    <Button
                      href={requirement.url}
                      ml="default"
                      as="a"
                      size="icon"
                      variant="text"
                      title="Learn More"
                    >
                      <Icon icon="ExternalLink" />
                    </Button>
                  )}
                </Text>

                {requirement.message && (
                  <MessageBox
                    my="default"
                    variant="warning"
                    message="Problem durring requirements check"
                  >
                    {requirement.message}

                    {requirement.errorMessage && (
                      <Text>Error Message: {requirement.errorMessage}</Text>
                    )}
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
          disabled={
            requirementsStatus !== "success" || currentActivity !== "none"
          }
          onClick={() => sendDeploymentAction("deploy")}
        >
          {currentActivity === "deploy" ? (
            <Icon icon="Loader" spin={true} />
          ) : (
            <Icon icon="UploadCloud" />
          )}
          Deploy
        </Button>
        &nbsp; &nbsp;
        <Button
          variant="contained"
          size="lg"
          rounded={true}
          disabled={currentActivity !== "none"}
          onClick={() => sendDeploymentAction("preview")}
        >
          {currentActivity === "preview" ? (
            <Icon icon="Loader" spin={true} />
          ) : (
            <Icon icon="Eye" />
          )}
          Preview
        </Button>
        &nbsp; &nbsp;
        <Button
          variant="outlined"
          size="lg"
          rounded={true}
          onClick={refresh}
          disabled={currentActivity !== "none"}
        >
          {currentActivity === "refresh" ||
          currentActivity === "requirements" ? (
            <Icon icon="Loader" spin={true} />
          ) : (
            <Icon icon="RefreshCw" />
          )}
          Refresh Info
        </Button>
        &nbsp; &nbsp;
        <Button
          variant="outlined"
          size="lg"
          disabled={currentActivity !== "none"}
          rounded={true}
          color="danger"
          onClick={() => sendDeploymentAction("destroy")}
        >
          {currentActivity === "destroy" ? (
            <Icon icon="Loader" spin={true} />
          ) : (
            <Icon icon="Trash2" />
          )}
          Destroy Deployed Resources
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
