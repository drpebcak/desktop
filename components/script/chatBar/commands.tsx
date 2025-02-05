import { Card, Listbox, ListboxItem, Menu } from "@nextui-org/react";
import React, { useEffect, useContext } from "react";
import { GoAlert, GoInbox, GoIssueReopened, GoPaperclip, GoTools } from "react-icons/go";
import { PiToolbox } from "react-icons/pi";
import { ScriptContext } from "@/contexts/script";
import Upload from "@/components/script/chatBar/upload";
import ToolCatalog from "@/components/script/chatBar/toolCatalog";
import { Message, MessageType } from "@/components/script/messages";
import { useFilePicker } from "use-file-picker";
import { uploadFile } from "@/actions/upload";
import { getWorkspaceDir } from "@/actions/workspace";

/*
    note(tylerslaton):
    
    This component really needs refactoring but due to time I'm leaving it as is. To 
    assist with anyone touching this in the future (or myself) here are some notes.

    The big problem with this component is that the chatBar is handing off the focus
    based on events. Each component knows what the hand off via a className. The ChatBar
    component is setting the focus to whatever the current 0th command is at the command-0
    class. This is then passing it back whenever text is input via the onKeyDown event.

    There is also some functionality where keyDown being an up-arrow in the chat bar will
    pass the focus to this component but this component *also* has a keyDown event that
    looks for the up-arrow. As such I have a keyDownCapture event that will pass the focus
    to the previous command in the list. This is a bit hacky but it works for now.
*/ 

const options = [
    {
        title: "Restart Chat",
        command: "restart",
        description: "Restart the current assistant to get a new session",
        icon: <GoIssueReopened className="mr-2" />,
    },
    {
        title: "Add Knowledge",
        command: "knowledge",
        description: "Add knowledge to the current assistant to extend functionality",
        icon: <GoPaperclip className="mr-2" />,
    },
    {
        title: "Add Tools",
        command: "add",
        description: "Add tools to the current assistant to extend functionality",
        icon: <PiToolbox className="mr-2" />,
    },
    {
        title: "Manage Workspace",
        command: "workspace",
        description: "Manage the workspace which contains the files the assistant has access to",
        icon: <GoInbox className="mr-2" />,
    },
];

interface CommandsProps {
    text: string;
    setText: (text: string) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    children: React.ReactNode;
}

export default function Commands({text, setText, isOpen, setIsOpen, children }: CommandsProps) {
    const [filteredOptions, setFilteredOptions] = React.useState<typeof options>(options);
    const [uploadOpen, setUploadOpen] = React.useState(false);
    const [toolCatalogOpen, setToolCatalogOpen] = React.useState(false);
    const {restartScript, socket, setMessages, tools, tool, setTool} = useContext(ScriptContext);
    const { openFilePicker, filesContent, loading, plainFiles } = useFilePicker({});
    

    useEffect(() => {
        if (!text.startsWith("/")) {
            setIsOpen(false);
            return;
        }

        const command = text.slice(1).toLowerCase();
        if (!command) return setFilteredOptions(options);

        setFilteredOptions(options.filter((option) => option.command.startsWith(command)));
    }, [text]);

    useEffect(() => {
        if (loading) return;
        if (!filesContent.length) return;

        let addedMessages = [] as Message[];
        for (const file of plainFiles) {
            const formData = new FormData();
            formData.append('file', file);
            
            getWorkspaceDir()
                .then((workspace) =>
                    uploadFile(workspace, formData)
                        .then(() => {
                            addedMessages.push({
                                type: MessageType.Alert,
                                icon: <GoPaperclip className="mt-1"/>,
                                message: `Added knowledge ${file.name}`
                            });
                        })
                        .catch((error) => {
                            addedMessages.push({
                                type: MessageType.Alert,
                                icon: <GoAlert className="mt-1"/>,
                                message: `Error adding knowledge ${file.name}: ${error}`
                            });
                        })
                        .finally(() => {
                            setMessages((prev) => [...prev, ...addedMessages])
                            if (!tool || tool.tools?.includes("github.com/gptscript-ai/knowledge@gateway")) return;
                            setTool((prev) => ({...prev, tools: [...prev.tools || [], "github.com/gptscript-ai/knowledge@gateway"]}));
                            socket?.emit("addTool", "github.com/gptscript-ai/knowledge@gateway");
                        })
                );
        }

    }, [filesContent, loading, tool]);
    
    const handleSelect = (value: string) => {
        switch (value) {
            case "restart":
                restartScript();
                break;
            case "add":
                setToolCatalogOpen(true);
                break;
            case "workspace":
                setUploadOpen(true);
                break;
            case "knowledge":
                openFilePicker();
                break;
        }

        setText('');
        setIsOpen(false);
    }

    return (
        <div className="relative w-full command-options">
            <Upload isOpen={uploadOpen} setIsOpen={setUploadOpen}/>
            <ToolCatalog 
                tools={tools}
                addTool={(tool) => {
                    socket?.emit("addTool", tool);
                    setMessages((prev) => [
                        ...prev, 
                        {
                            type: MessageType.Alert,
                            icon: <GoTools className="mt-1"/>,
                            message: `Added ${
                                tool.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                            }`
                        }
                    ]);
                }}
                removeTool={(tool) => {
                    socket?.emit("removeTool", tool);
                    setMessages((prev) => [
                        ...prev, 
                        {
                            type: MessageType.Alert,
                            icon: <GoTools className="mt-1"/>,
                            message: `Removed ${
                                tool.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                            }`
                        }
                    ]);
                }}
                isOpen={toolCatalogOpen}
                setIsOpen={setToolCatalogOpen}
            />
            {isOpen && !!filteredOptions.length && (
                <Card className="absolute bottom-14 w-full p-4">
                    <Listbox aria-label="commands">
                        {filteredOptions.map((option, index) => (
                            <ListboxItem 
                                aria-label="command"
                                key={index}
                                value={option.title}
                                onClick={() => handleSelect(option.command)}
                                startContent={option.icon}
                                id={`command-${index}`}
                                description={option.description}

                                // Handle selecting the command or closing the modal in a terrible awful way.
                                onKeyDown={(e) => {
                                    e.preventDefault();
                                    switch(e.key) {
                                        case "Enter":
                                            handleSelect(option.command);
                                            break;
                                        case "ArrowUp":
                                        case "ArrowDown":
                                            break;
                                        case "Escape":
                                            setIsOpen(false);
                                        default:
                                            setText(text + e.key);
                                            document.getElementById("chatInput")?.focus();
                                            break;
                                    }
                                }}

                                // Handle navigating the list of commands (also in a terrible awful way)
                                onKeyDownCapture={(e) => {
                                    e.preventDefault();
                                    switch(e.key) {
                                        case "ArrowUp":
                                            const prev = document.getElementById(`command-${index - 1}`);
                                            if(prev) prev.focus();
                                            break;
                                        case "ArrowDown":
                                            const next = document.getElementById(`command-${index + 1}`);
                                            if(next) next.focus();
                                            break;
                                    }
                                }}
                            >
                                {option.title}
                            </ListboxItem>
                        )).reverse() /* reverse the order to make navigating the commands more intuitive */}
                    </Listbox>
                </Card>
            )}
            {children}
        </div>
    );
}
