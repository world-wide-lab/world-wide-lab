import React, {useState, useEffect} from 'react'
import styled from 'styled-components'
import {
  Box,
  H2,
  H5,
  H4,
  Text,
  Illustration,
  IllustrationProps,
  Button,
  Icon,
} from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import { DashboardLineChart } from '../charts/DashboardLineChart'

const pageHeaderHeight = 284
const pageHeaderPaddingY = 74
const pageHeaderPaddingX = 250

export const DashboardHeader: React.FC = () => {
  return (
    <Box position="relative" overflow="hidden" data-css="default-dashboard">
      <Box
        position="absolute"
        top={50}
        left={-10}
        opacity={[0.2, 0.4, 1]}
        animate
      >
        <Illustration variant="Rocket" />
      </Box>
      <Box
        position="absolute"
        top={-70}
        right={-15}
        opacity={[0.2, 0.4, 1]}
        animate
      >
        <Illustration variant="Moon" />
      </Box>
      <Box
        bg="grey100"
        height={pageHeaderHeight}
        py={pageHeaderPaddingY}
        px={['default', 'lg', pageHeaderPaddingX]}
      >
        <Text textAlign="center" color="white">
          <H2> Welcome to World-Wide-Lab! </H2>
          <Text opacity={0.8}>
            A complete solution for storing data in online-studies with special support for supporting citizen science projects.
          </Text>
        </Text>
      </Box>
    </Box>
  )
}

type BoxType = {
  variant: string;
  title: string;
  subtitle: string;
  href: string;
}

const boxes : Array<BoxType> = [{
  variant: 'Planet',
  title: 'Launch your Next Study',
  subtitle: 'Click here to create a new study on World-Wide-Lab.',
  href: '/admin/resources/wwl_studies/actions/new',
}, {
  variant: 'DocumentCheck',
  title: 'Read the Docs',
  subtitle: 'Learn everything about using World-Wide-Lab in our official documentation.',
  href: 'https://world-wide-lab.github.io/world-wide-lab/',
}, {
  variant: 'Astronaut',
  title: 'Check out the Code',
  subtitle: 'World-Wide-Lab is open-source, so you can look directly at its codebase.',
  href: 'https://github.com/world-wide-lab/world-wide-lab',
}]

const Card = styled(Box)`
  position: relative;
  overflow: hidden;
  display: ${({ flex }): string => (flex ? 'flex' : 'block')};
  color: ${({ theme }): string => theme.colors.grey100};
  text-decoration: none;
  border: 1px solid transparent;
  &:hover {
    border: 1px solid ${({ theme }): string => theme.colors.primary100};
    box-shadow: ${({ theme }): string => theme.shadows.cardHover};
  }
`

const CardLabel = styled(Text)`
  margin-bottom: 1rem;
`

const LargeNumber = styled(Box)`
  font-size: 3.5rem;
  line-height: 1.2;
`

const LargeNumberBoxBackground = styled(Box)`
  position: absolute;
  z-index: 0;
  opacity: 0.15;
  right: 2rem;
  top: 1rem;
`

Card.defaultProps = {
  variant: 'white',
  boxShadow: 'card',
}

export const Dashboard: React.FC = () => {
  const [studyCountData, setStudyCountData] = useState("X")
  const [chartData, setChartData] = useState(null)

  // Retrieve data from dashboard handler
  const api = new ApiClient()
  useEffect(() => {
    api.getDashboard()
      .then((response) => {
        console.log("Retrieved dashboard data", response.data)

        setStudyCountData(response.data.studyCount.toString())
        setChartData(response.data.fullRunCounts)
      })
      .catch((error) => {
        // Handle errors here
        console.error("Error retrieving dashboard data", error)
      })
  }, [])

  return (
    <Box>
      <DashboardHeader />
      <Box
        mt={['xl', 'xl', '-100px']}
        mb="xl"
        mx={[0, 0, 0, 'auto']}
        px={['default', 'lg', 'xxl', '0']}
        position="relative"
        flex
        flexDirection="row"
        flexWrap="wrap"
        width={[1, 1, 1, 1024]}
      >

        <Box width={[1, 1 / 2, 1 / 2, 2 / 3]} p="lg">
          <Card>
            <Box><CardLabel>Started / Finished Runs this Week</CardLabel></Box>
            <DashboardLineChart data={chartData}></DashboardLineChart>
          </Card>
        </Box>
        <Box width={[1, 1 / 2, 1 / 2, 1 / 3]} p="lg">
          <Card as="a" href="/admin/resources/wwl_studies">
          <LargeNumberBoxBackground>
            <Illustration variant="FlagInCog" />
          </LargeNumberBoxBackground>
            <Box>
              <CardLabel>Number of Studies</CardLabel>
              <LargeNumber>{ studyCountData }</LargeNumber>
            </Box>
          </Card>
        </Box>
        {boxes.map((box, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Box key={index} width={[1, 1 / 2, 1 / 2, 1 / 3]} p="lg">
            <Card as="a" href={box.href} target={box.href.startsWith("http") ? "_blank" : "_self"}>
              <Text textAlign="center">
                <Illustration
                  variant={box.variant as IllustrationProps['variant']}
                  width={100}
                  height={70}
                />
                <H5 mt="lg">{box.title}</H5>
                <Text>{box.subtitle}</Text>
              </Text>
            </Card>
          </Box>
        ))}
        {/* Disable the second part of the Dashboard for now, as we don't have all the relevant ressources yet */}
        {/* <Box width={[1, 1, 1 / 2]} p="lg">
          <Card as="a" flex href="https://adminjs.page.link/slack" target="_blank">
            <Box flexShrink={0}><Illustration variant="SlackLogo" /></Box>
            <Box ml="xl">
              <H4>{'community_title'}</H4>
              <Text>{'community_subtitle'}</Text>
            </Box>
          </Card>
        </Box>
        <Box width={[1, 1, 1 / 2]} p="lg">
          <Card as="a" flex href="https://github.com/SoftwareBrothers/adminjs/issues" target="_blank">
            <Box flexShrink={0}><Illustration variant="GithubLogo" /></Box>
            <Box ml="xl">
              <H4>{'foundBug_title'}</H4>
              <Text>{'foundBug_subtitle'}</Text>
            </Box>
          </Card>
        </Box>
        <Box variant="white" boxShadow="card" width={1} m="lg">
          <Text textAlign="center">
            <Illustration variant="AdminJSLogo" />
            <H4>{'needMoreSolutions_title'}</H4>
            <Text>{'needMoreSolutions_subtitle'}</Text>
            <Text mt="xxl">
              <Button
                as="a"
                variant="primary"
                href="https://share.hsforms.com/1IedvmEz6RH2orhcL6g2UHA8oc5a"
                target="_blank"
              >
                {'contactUs'}
              </Button>
            </Text>
          </Text>
        </Box> */}
      </Box>
    </Box>
  )
}

export default Dashboard
