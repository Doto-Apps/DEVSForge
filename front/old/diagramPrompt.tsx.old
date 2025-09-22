"use client"

import { useState } from 'react';
import { Input } from '../../components/ui/input.tsx';
import { Textarea } from "@/components/ui/textarea"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button.tsx"
import { useToast } from "@/hooks/use-toast"
import {useAuth} from "@/providers/AuthProvider";
import { DiagramDataType } from '@/types';

import {client} from "@/api/client";
import { convertDevsToReactFlow } from '@/lib/convertDevsToReactFlow.ts';

const formSchema = z.object({

    diagramName: z.string().min(4, {
        message: "The diagram name must be at least 4 characters long.",
    }),
    prompt: z.string().min(10, {
        message: "The prompt must be at least 20 characters long.",
    }),
})




export default function DiagramPrompt({
    onGenerate,
    stage
}: {
    onGenerate: (diagramData: DiagramDataType
    ) => void;
    stage: number;
}) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast()
    const { token } = useAuth();


    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            diagramName: "",
            prompt: "",
        },
    })
    


    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        try {
            const response = await client.POST("/ai/generate-diagram", {
                body: {
                    userPrompt: values.prompt,
                    diagramName: values.diagramName,
                },

            });
    
            if (!response.data) {
                throw new Error("No data received from API");
            }
            const diagramData = response.data;
            console.log(diagramData)
            const convertedData = convertDevsToReactFlow(diagramData);
            onGenerate(convertedData);
            toast({
                title: "Diagram generated successfully!",
            });
        } catch (error) {
            toast({
                title: "Error generating diagram",
                description: (error as Error).message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className='h-full w-full flex justify-center items-center' >
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg text-foreground">Generating your diagram...</p>
                </div>
            </div>

        )
    }
    else
        return (
            <div className='h-full w-full flex flex-col justify-center items-center' >
                <div className='text-3xl text-foreground pb-20 font-bold'>
                    DEVS diagram Generator
                </div>

                <Form {...form} >
                    <form onSubmit={form.handleSubmit(onSubmit)} className="w-4/5 space-y-8">
                        <FormField
                            control={form.control}
                            name="diagramName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Diagram Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Single light diagram" {...field} />
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prompt</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="A switch connected to a light."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit">{stage === 0 ? "Generate" : "Regenerate"}</Button>
                    </form>
                </Form>
            </div>
        );
};
