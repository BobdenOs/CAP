sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
  const comp = AppComponent.extend("app.Component", {
    metadata: { manifest: "json" }
  })

  comp.uploadTar = async function (a, b, c, d) {
    const pickerOptions = {
      types: [
        {
          description: "Tar",
          accept: { "application/*": [".tar", ".tar.gz", ".tgz"] },
        },
      ],
      multiple: false,
    };

    try {
      const [fileHandle] = await window.showOpenFilePicker(pickerOptions)
      const file = await fileHandle.getFile()
      const res = await fetch(this.getModel().getServiceUrl() + `applications(name='${file.name.split('-').at(-2)}')/src`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      debugger
    } catch (error) {
      console.error("File selection canceled or failed:", error);
    }
  }

  return comp
})
