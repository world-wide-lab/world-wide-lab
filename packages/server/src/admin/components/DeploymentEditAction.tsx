import {
  Box,
  Button,
  DrawerContent,
  DrawerFooter,
  Icon,
  MessageBox,
} from "@adminjs/design-system";
import type React from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import {
  ActionHeader,
  type ActionProps,
  BasePropertyComponent,
  LayoutElementRenderer,
  type RecordJSON,
  useRecord,
  useTranslation,
} from "adminjs";

import { randomString } from "../helpers.js";

// Odd error: getActionElementCss is not defined, despite its types being exported by adminjs
// Thankfully it's pretty simple code which we can copy over from
// https://github.com/SoftwareBrothers/adminjs/blob/master/src/frontend/utils/data-css-name.ts
const getDataCss = (...args: (string | number)[]) => args.join("-");
const getActionElementCss = (
  resourceId: string,
  actionName: string,
  suffix: string,
) => getDataCss(resourceId, actionName, suffix);

const EDIT_READONLY_PROPERTIES = ["type", "stackConfig"];

const getDefaultStackConfig = (type: string) => {
  switch (type) {
    case "aws_apprunner":
      return {
        awsRegion: "us-east-1",
      };
    case "azure_containerapp":
      return {
        location: "eastus",
      };
    default:
      return {};
  }
};

const getDefaultDeploymentConfig = (type: string) => {
  const defaultConfig = {
    secret_dbUsername: `user_${randomString(6)}`,
    secret_dbPassword: randomString(20),
    secret_wwlAdminAuthDefaultEmail: `hello_${randomString(6)}@example.com`,
    secret_wwlAdminAuthDefaultPassword: randomString(20),
    secret_wwlAdminAuthSessionSecret: randomString(20),
    secret_wwlDefaultApiKey: randomString(20),
  };

  switch (type) {
    case "aws_apprunner":
      return {
        ...defaultConfig,

        dbDeletionProtection: true,

        cpu: 256,
        memory: 512,
      };
    case "azure_containerapp":
      return {
        ...defaultConfig,

        cpu: 0.5,
        memory: 1,
      };
    default:
      return {};
  }
};

const DeploymentEditAction: React.FC<ActionProps> = (props) => {
  const { record: initialRecord, resource, action } = props;

  const {
    record,
    handleChange,
    submit: handleSubmit,
    loading,
    setRecord,
  } = useRecord(initialRecord, resource.id);

  const { translateButton } = useTranslation();
  const navigate = useNavigate();

  const isNew = action.name !== "edit";

  // Handle type changes to update default configs
  const handleTypeChange = (
    propertyOrRecord: string | RecordJSON,
    value?: any,
  ) => {
    if (typeof propertyOrRecord === "string") {
      const propertyPath = propertyOrRecord;
      if (propertyPath === "type" && value) {
        updateDefaults(value);
      }
      handleChange(propertyPath, value);
    }
    handleChange(propertyOrRecord, value);
  };

  const updateDefaults = (type: string) => {
    const stackConfig = getDefaultStackConfig(type);
    const deploymentConfig = getDefaultDeploymentConfig(type);

    handleChange("stackConfig", JSON.stringify(stackConfig, null, 2));
    handleChange("deploymentConfig", JSON.stringify(deploymentConfig, null, 2));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: This should only be run once
  useEffect(() => {
    if (!initialRecord?.id) {
      updateDefaults(initialRecord?.params?.type);
    }
  }, [initialRecord]);

  const submit = (event: React.FormEvent<HTMLFormElement>): boolean => {
    event.preventDefault();
    handleSubmit().then((response: { data: { redirectUrl?: string } }) => {
      if (response.data.redirectUrl) {
        const url = response.data.redirectUrl;
        // Add _admin=true to force a refresh
        navigate(
          url.includes("?") ? `${url}&_admin=true` : `${url}?_admin=true`,
        );
      }
    });
    return false;
  };

  const contentTag = getActionElementCss(
    resource.id,
    action.name,
    "drawer-content",
  );
  const formTag = getActionElementCss(resource.id, action.name, "form");
  const footerTag = getActionElementCss(
    resource.id,
    action.name,
    "drawer-footer",
  );
  const buttonTag = getActionElementCss(
    resource.id,
    action.name,
    "drawer-submit",
  );

  return (
    <Box
      as="form"
      onSubmit={submit}
      flex
      flexDirection="column"
      data-css={formTag}
    >
      <DrawerContent data-css={contentTag}>
        {action?.showInDrawer ? <ActionHeader {...props} /> : null}

        {action.layout
          ? action.layout.map((layoutElement, i) => (
              <LayoutElementRenderer
                // biome-ignore lint/suspicious/noArrayIndexKey: Based on AdminJS source code
                key={i}
                layoutElement={layoutElement}
                {...props}
                where="edit"
                onChange={handleTypeChange}
                record={record}
              />
            ))
          : resource.editProperties.map((property) => {
              let where: "show" | "edit" = "edit";
              if (
                !isNew &&
                EDIT_READONLY_PROPERTIES.includes(property.propertyPath)
              ) {
                console.log(property.propertyPath);
                where = "show";
              }

              return (
                <BasePropertyComponent
                  key={property.propertyPath}
                  where={where}
                  onChange={handleTypeChange}
                  property={property}
                  resource={resource}
                  record={record}
                />
              );
            })}
      </DrawerContent>
      <DrawerFooter data-css={footerTag}>
        <Button
          variant="contained"
          type="submit"
          data-css={buttonTag}
          data-testid="button-save"
          disabled={loading}
        >
          {loading ? <Icon icon="Loader" spin /> : null}
          {translateButton("save", resource.id)}
        </Button>
      </DrawerFooter>
    </Box>
  );
};

export default DeploymentEditAction;
