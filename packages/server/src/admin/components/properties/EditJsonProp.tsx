import { Box, Icon, Label } from "@adminjs/design-system";
import { useCallback, useEffect, useState } from "react";

import { Editor, loader } from "@monaco-editor/react";
import { extractJsonObjectFromRecord } from "../../helpers.js";

// Set up monaco without extra download
loader.config({
  paths: {
    vs: "/static/monaco-editor/vs",
  },
});

const ShowJsonProp = (props: any) => {
  const { property, record, onChange } = props;

  const object = extractJsonObjectFromRecord(property.name, record);

  // Pretty print the object
  const defaultValue =
    object !== undefined
      ? JSON.stringify(object, undefined, 2)
      : property.custom.defaultValue || "";

  const [jsonStatus, setJsonStatus] = useState<string>("");
  const updateValue = (newValue: string | undefined) => {
    try {
      // @ts-ignore
      const parsedNewValue = JSON.parse(newValue);
      onChange(property.path, parsedNewValue);
      setJsonStatus("success");
    } catch (err) {
      // Do nothing
      setJsonStatus("error");
    }
  };
  const handleUpdate = useCallback(updateValue, []);

  // Set default value
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (object === undefined && property.custom.defaultValue) {
      updateValue(defaultValue);
    }
  }, []);

  return (
    <Box mb="xl">
      <Label>
        {property.label}
        &nbsp;
        <Icon
          icon={
            jsonStatus === "error"
              ? "XCircle"
              : jsonStatus === "success"
                ? "CheckCircle"
                : "Circle"
          }
          title={
            jsonStatus === "error"
              ? "Error: Invalid JSON."
              : jsonStatus === "success"
                ? "JSON saved successfully."
                : "This circle indicates whether the JSON was saved successfully."
          }
          style={{ opacity: 0.5 }}
        />
      </Label>
      <Editor
        options={{ minimap: { enabled: false } }}
        onChange={handleUpdate}
        defaultValue={defaultValue}
        theme="vs-dark"
        defaultLanguage="json"
        height="8em"
      />
    </Box>
  );
};

export default ShowJsonProp;
