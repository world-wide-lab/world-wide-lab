import { Box, Label, Link, Text, Select, DrawerContent, DrawerFooter, Button } from '@adminjs/design-system'
import { useState, useMemo } from 'react'
import { ActionProps } from 'adminjs'

const MyNewAction = (props: ActionProps) => {
  const { resource, action, record } = props

  if (record === undefined) {
    throw new Error("Missing record")
  }
  const studyId = record.id

  const dataTypeOptions = [
    { value: 'responses-extracted-payload', label: 'Responses (extracted)' },
    { value: 'responses-raw', label: 'Responses (unprocessed)' },
    { value: 'runs-raw', label: 'Runs (unprocessed)' },
    { value: 'participants-raw', label: 'Participants (unprocessed)' },
  ]
  const [dataType, setDataType] = useState(dataTypeOptions[0])

  const formatOptions = [
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' },
  ]
  const [format, setFormat] = useState(formatOptions[0])

  const filename = useMemo(() => `wwl--${studyId}--data--${dataType.value}.${format.value}`, [dataType, format])
  const url = useMemo(() => `/admin/wwl/study/${studyId}/data/${dataType.value}`, [dataType, format])

  // do something with the props and render action
  return (
    <>
      <DrawerContent>
        <Box variant="container">
          <Box p="xl" flex justifyContent="space-between" style={{ gap: 16 }}>
            <Box width="100%">
              <Label>Data Type</Label>
              <Select value={dataType} onChange={(selected) => setDataType(selected)} options={dataTypeOptions} />
            </Box>
            <Box width="100%">
              <Label>File Format</Label>
              <Select isDisabled={true} value={format} onChange={(selected) => setFormat(selected)} options={formatOptions} />
            </Box>
          </Box>
          <Box p="xl" flex justifyContent="space-between" style={{ gap: 16 }}>
            <Box width="100%">
              <Label>Filename</Label>
              <Text variant="sm">
                {filename}
              </Text>
            </Box>
            <Box width="100%">
              <Label>Download URL (requires authentication)</Label>
              <Text variant="sm">
                <Link href={url}> {url} </Link>
              </Text>
            </Box>
          </Box>
        </Box>
      </DrawerContent>
      <DrawerFooter>
        <Button as="a" href={url} download={filename} variant="contained" style={{ cursor: 'pointer' }}>Download</Button>
      </DrawerFooter>
    </>
  )
}

export default MyNewAction