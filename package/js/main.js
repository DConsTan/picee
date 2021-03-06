import $fetch from './fetch.js'
import chooseImg from './chooseImg.js'
import paste from './paste.js'

const CHECK_TOKEN = 'https://api.github.com'
const UPLOAD = 'https://api.github.com/repos'

const uploadUrl = (repo, folder, file) => {
  return `${UPLOAD}/${repo}/contents/${folder ? folder + '/' : ''}${file}`
}

new Vue({
  el: '#app',
  data () {
    return {
      loginMode: true,
      authMode: 'token',
      githubToken: '',
      githubAccount: '',
      githubPassword: '',

      repoName: '',
      folderPath: '',
      isRepoNameCorrect: false,
      previewImg: '',
      imgBase64: '',
      imgLink: '',
      fileName: '',

      autoUpload: false,
      uploaderFocus: false,
      uploadProgress: 0,
      compressSize: 400,
      showConfig: false,

      isSameImage: false
    }
  },
  async mounted () {
    const token = localStorage.getItem('picee_token')
    if (token) {
      this.accessToken = token
      this.loginMode = false
    }

    const repoName = localStorage.getItem('picee_repo')
    if (repoName) {
      this.isRepoNameCorrect = true
      this.repoName = repoName
    }

    const folderPath = localStorage.getItem('picee_folder')
    if (folderPath) {
      this.folderPath = folderPath
    }

    const autoUpload = localStorage.getItem('picee_auto_upload')
    if (autoUpload) {
      this.autoUpload = true
    } else {
      this.autoUpload = false
    }

    const compressSize = localStorage.getItem('picee_compress_size')
    if (compressSize) {
      this.compressSize = Number(compressSize)
    }
  },
  watch: {
    autoUpload (val) {
      if (val) {
        localStorage.setItem('picee_auto_upload', true)
      } else {
        localStorage.removeItem('picee_auto_upload')
      }
    },
    compressSize (val) {
      localStorage.setItem('picee_compress_size', val)
    }
  },
  methods: {
    // auth
    changeAuthMode (mode) {
      this.authMode = mode
    },
    logout () {
      localStorage.removeItem('picee_token')
      localStorage.removeItem('picee_repo')
      localStorage.removeItem('picee_folder')
      localStorage.removeItem('picee_compress_size')
      this.resetAuth()
    },
    resetAuth () {
      this.loginMode = true
      this.githubToken = ''
      this.githubPassword = ''
      this.githubAccount = ''
    },
    async submitAuth () {
      if (this.authMode === 'token') {
        localStorage.setItem('picee_token', 'Bearer ' + this.githubToken)
      } else {
        localStorage.setItem('picee_token', 'Basic ' + btoa(this.githubAccount + ':' + this.githubPassword))
      }

      const { status } = await $fetch({
        url: CHECK_TOKEN
      })
      
      if (status > 400) {
        alert('Unauthorized identify, please take a check and try again.')
        localStorage.removeItem('picee_token')
        this.resetAuth()
        return
      }

      this.loginMode = false
    },

    // upload
    setRepoName () {
      if (this.repoName.split('/').length === 2) {
        this.isRepoNameCorrect = true
        localStorage.setItem('picee_repo', this.repoName)
        localStorage.setItem('picee_folder', this.folderPath)
      } else {
        alert('Illegal project name!')
        this.repoName = localStorage.getItem('picee_repo') || ''
      }
    },
    refresh () {
      this.imgBase64 = ''
      this.previewImg = ''
      this.imgLink = ''
    },
    onUploaderFocus (e) {
      this.uploaderFocus = e.target.classList.contains('target')
    },
    getImage (url, fileName) {
      this.isSameImage = false
      this.imgBase64 = url
      this.previewImg = url
      this.fileName = fileName.replace('.', `.${Math.random().toString(36).substr(2)}.`)

      if (this.autoUpload) {
        this.upload()
      }
    },
    onDrop (e) {
      this.uploaderFocus = true
      const imgEvent = {
        target: {
          files: e.dataTransfer.files
        }
      }
      chooseImg(imgEvent, (url, fileName) => {
        this.getImage(url, fileName)
      }, this.compressSize * 1024)
    },
    onFileChange (e) {
      chooseImg(e, (url, fileName) => {
        this.getImage(url, fileName)
      }, this.compressSize * 1024)
    },
    async onPaste (e) {
      const { url, fileName } = await paste(e, this.compressSize * 1024)
      this.getImage(url, fileName)
    },
    copyUrl () {
      this.$refs['imgLink'].select()
      document.execCommand('copy')
      chrome.notifications.create(null, {
        type: 'basic',
        iconUrl: this.imgBase64,
        title: 'Copy success',
        message: 'Image url has been copied to cliboard.'
      });
    },
    async upload () {
      if (this.isSameImage) {
        return
      }

      this.isSameImage = true

      this.uploadProgress = parseInt(Math.random() * 20)
      const result = await $fetch({
        url: uploadUrl(this.repoName, this.folderPath, this.fileName),
        method: 'PUT',
        body: {
          message: 'upload from Picee',
          content: this.imgBase64.split(',')[1]
        }
      }).catch(e => e)

      if (result.data) {
        this.uploadProgress = 100
        setTimeout(() => {
          this.uploadProgress = 0
        }, 2000)

        chrome.notifications.create(null, {
          type: 'basic',
          iconUrl: this.imgBase64,
          title: 'Upload success',
          message: 'Image has been uploaded.'
        });

        this.imgLink = result.data.content.download_url
        this.uploaderFocus = false
      } else {
        this.uploadProgress = 0
        alert(`errCode: ${result.status}\nPlease check the repo name or your network and try again.`)
      }
    }
  }
})
