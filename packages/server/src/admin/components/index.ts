import { ComponentLoader } from 'adminjs'

const componentLoader = new ComponentLoader()

const Components = {
  ApiDocsPage: componentLoader.add('ApiDocsPage', './pages/api-docs'),
  StudyDownloadAction: componentLoader.add('StudyDownloadAction', './StudyDownloadAction'),
}

export { componentLoader, Components }