import { Box, Icon, Label, Text } from "@adminjs/design-system";
import type { BasePropertyProps } from "adminjs";
import { useCallback, useEffect, useState } from "react";

import { Editor, loader } from "@monaco-editor/react";
import { extractJsonObjectFromRecord } from "../../helpers.js";

// Set up monaco without extra download
loader.config({
  paths: {
    vs: "/static/monaco-editor/vs",
  },
});

const ShowJsonProp = (props: BasePropertyProps) => {
  const { property, record, onChange } = props;

  const object = extractJsonObjectFromRecord(property.name, record);

  // Pretty print the object
  const defaultValue =
    object !== undefined
      ? JSON.stringify(object, undefined, 2)
      : property.custom.defaultValue || "";

  const [value, setValue] = useState(defaultValue);
  const [jsonStatus, setJsonStatus] = useState<string>("");

  // Update value when property changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Seems to be confused by nested dependencies
  useEffect(() => {
    let newValue = record?.params?.[property.name];
    console.log(newValue);
    if (newValue) {
      if (newValue !== value) {
        // Make sure the new value is a string
        if (typeof newValue !== "string") {
          newValue = JSON.stringify(newValue);
        }

        updateValue(newValue);
      }
    }
  }, [record?.params?.[property.name]]);

  const updateValue = (newValue: string | undefined) => {
    if (newValue === undefined) return;
    setValue(newValue);
    try {
      const parsedNewValue = JSON.parse(newValue);
      // @ts-ignore - This should be caught by try/catch
      onChange(property.path, parsedNewValue);
      setJsonStatus("success");
    } catch (err) {
      // Do nothing
      setJsonStatus("error");
    }
  };
  const handleUpdate = useCallback(updateValue, []);

  // Set default value
  // biome-ignore lint/correctness/useExhaustiveDependencies: This should only run once
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
      {property.description && <Text my="default">{property.description}</Text>}
      <Editor
        options={{ minimap: { enabled: false } }}
        onChange={handleUpdate}
        value={value}
        theme="vs-dark"
        defaultLanguage="json"
        height="8em"
      />
    </Box>
  );
};

export default ShowJsonProp;
