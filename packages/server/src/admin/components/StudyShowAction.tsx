import {
  Box,
  Button,
  DrawerContent,
  H3,
  Icon,
  Label,
  MessageBox,
  Select,
  Text,
} from "@adminjs/design-system";
import type React from "react";
import { useEffect, useState } from "react";

import {
  ActionHeader,
  type ActionProps,
  BasePropertyComponent,
  LayoutElementRenderer,
} from "adminjs";

import {
  Code,
  CodeHighlightingStyles,
  highlightText,
  refreshHighlighting,
} from "./partials/codeHighlighting.js";

const StudyShowAction: React.FC<ActionProps> = (props) => {
  const { resource, record, action } = props;
  const properties = resource.showProperties;

  const studyId = record?.params?.studyId;
  const escapedStudyId = `'${studyId}'`;
  const escapedUrl = `'${window.location.origin}'`;

  const formatOptions = [
    { value: "jsPsych-integration", label: "Using the jsPsych Integration" },
    { value: "client", label: "Using the WWL Client directly" },
  ];
  const [format, setFormat] = useState(formatOptions[0]);

  const exampleCode = {
    "jsPsych-integration": `import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response'
import jsPsychWorldWideLab from '@world-wide-lab/integration-jspsych'

const jsPsych = jsPsychWorldWideLab.initJsPsych(
  {
    // Options to pass to the normal initJsPsych()
  },
  {
    // Options for the World-Wide-Lab Integration
    // URL to where World-Wide-Lab is running
    url: ${escapedUrl},
    // Id of the study you're running
    studyId: ${escapedStudyId},
  }
)

const timeline = [
  {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "Please press your favourite key on the keyboard.",
  }
]

jsPsych.run(timeline);
`,
    client: `import { Client } from '@world-wide-lab/client';

const client = new Client({
  url: ${escapedUrl}
});

// Start a new session
const session = await client.createSession({
  studyId: ${escapedStudyId}
});

// Send responses to the API
session.response({
  name: 'my-trial',
  payload: {
    some: 'data'
  }
})

// ... collect many more responses via session.response()

// Mark the session as finished at the end of your experiment
session.finish();
`,
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Automatic detection of dependencies is not correct
  useEffect(() => {
    refreshHighlighting();

    highlightText(escapedUrl);
    highlightText(escapedStudyId);
  }, [format]);

  return (
    <DrawerContent>
      <H3>Study Data</H3>

      {record?.params?.deletionProtection === false && (
        <Box style={{ margin: "1rem 0" }}>
          <MessageBox
            message="Warning: Study is not protected"
            mt="default"
            variant="danger"
          >
            <p>
              This study is currently not protected from being deleted. If it is
              deleted, so is all data related to it.
            </p>
            <p>
              This includes all Sessions and Responses linked to the study.
              Enable deletionProtection to protect this study.
            </p>
          </MessageBox>
        </Box>
      )}

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

      <Box>
        <Button
          as="a"
          href={`/admin/resources/wwl_sessions?filters.studyId=${studyId}&page=1`}
          variant="contained"
          style={{ cursor: "pointer" }}
        >
          <Icon icon="Eye" /> View Sessions in this Study
        </Button>
        &nbsp; &nbsp;
        <Button
          as="a"
          href={`/admin/resources/wwl_studies/records/${studyId}/downloadData`}
          variant="contained"
          style={{ cursor: "pointer" }}
        >
          <Icon icon="Download" /> Download Data from this Study
        </Button>
      </Box>

      <H3>Integrating the Study</H3>

      <Text>
        You can use the following code to collect data for this study with your
        experiment. Simply pick the integration you wish to use and copy the
        relevant code into your experiment.
      </Text>

      <Box width="300px" style={{ margin: "1rem 0" }}>
        <Label>Integration Type</Label>
        <Select
          value={format}
          onChange={(selected) => setFormat(selected)}
          options={formatOptions}
        />
      </Box>

      <Box>
        <CodeHighlightingStyles />
        <pre>
          <Code>
            {format &&
              // @ts-ignore
              exampleCode[format.value]}
          </Code>
        </pre>
      </Box>
    </DrawerContent>
  );
};

export default StudyShowAction;
