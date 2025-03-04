import { Box, Label } from "@adminjs/design-system";
import { useEffect } from "react";

import { extractJsonObjectFromRecord } from "../../helpers.js";
import {
  Code,
  CodeHighlightingStyles,
  refreshHighlighting,
} from "../partials/codeHighlighting.js";

const ShowJsonProp = (props: any) => {
  const { property, record, onChange } = props;

  const object = extractJsonObjectFromRecord(property.name, record);

  // Pretty print the object
  const formattedObject =
    object !== undefined ? JSON.stringify(object, undefined, 2) : "(empty)";

  // biome-ignore lint/correctness/useExhaustiveDependencies: Automatic detection of dependencies is not correct
  useEffect(() => {
    refreshHighlighting();
  }, [formattedObject]);

  return (
    <Box mb="xl">
      <Label>{property.label}</Label>
      <CodeHighlightingStyles />
      <pre>
        <Code>{formattedObject}</Code>
      </pre>
    </Box>
  );
};

export default ShowJsonProp;
