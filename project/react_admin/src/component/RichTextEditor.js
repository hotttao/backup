import React, { Component } from 'react'
import { EditorState, convertToRaw, ContentState } from 'draft-js'
import { Editor } from 'react-draft-wysiwyg';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';

import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

export default class RichTextEditor extends Component {
    constructor(props) {
        super(props);
        this.state = {
          editorState: EditorState.createEmpty(),
        };
    }
    
    onEditorStateChange = (editorState) => {
        this.setState({
          editorState,
        });
    };

    componentWillReceiveProps(nextProps) {
        const contentBlock = htmlToDraft(nextProps.detail);
        if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            const editorState = EditorState.createWithContent(contentState);
            this.setState({
                editorState,
            });
        }
    }
    
    getDetail = ()=> draftToHtml(convertToRaw(this.state.editorState.getCurrentContent()))
    
    render() {
        const { editorState } = this.state;
            return (
                <div>
                    <Editor
                        editorState={editorState}
                        // wrapperClassName="demo-wrapper"
                        // editorClassName="demo-editor"
                        editorStyle={{border: '1px black solid', height: 200}}
                        onEditorStateChange={this.onEditorStateChange}
                        toolbar={{
                            image: { uploadCallback: uploadImageCallBack, alt: { present: true }, previewImage: true },
                            fontFamily: {
                            options: ['Arial', 'Georgia', 'Impact', 'Tahoma', 'Roboto', 'Times New Roman', 'Verdana'],
                            }
                        }}
                />
                <textarea
                    disabled
                    value={draftToHtml(convertToRaw(editorState.getCurrentContent()))}
                />
            </div>
            
            
            )
        }
    }


function uploadImageCallBack(file) {
    return new Promise(
        (resolve, reject) => {
        const xhr = new XMLHttpRequest(); // eslint-disable-line no-undef
        xhr.open('POST', 'https://api.imgur.com/3/image');
        xhr.setRequestHeader('Authorization', 'Client-ID 8d26ccd12712fca');
        const data = new FormData(); // eslint-disable-line no-undef
        data.append('image', file);
        xhr.send(data);
        xhr.addEventListener('load', () => {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
        });
        xhr.addEventListener('error', () => {
            const error = JSON.parse(xhr.responseText);
            reject(error);
        });
        }
    );
    }