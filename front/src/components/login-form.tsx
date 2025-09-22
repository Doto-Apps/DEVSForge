import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

const loginSchema = z.object({
	email: z.string().email().nonempty(),
	password: z.string().min(5),
});

export const LoginForm = () => {
	const { login } = useAuth();
	const form = useForm({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "admin@gmail.com", password: "Admin123" },
	});

	const handleLogin = async (values: z.infer<typeof loginSchema>) => {
		try {
			await login(values.email, values.password);
		} catch {
			form.setError("email", { message: "Login failed" });
		}
	};

	return (
		<Card className="mx-auto max-w-md">
			<CardHeader>
				<CardTitle className="text-2xl">Login</CardTitle>
				<CardDescription>
					Enter your credentials to access your account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleLogin)} className="space-y-6">
						<FormField
							name="email"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input {...field} placeholder="example@email.com" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							name="password"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<Input {...field} placeholder="********" type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full">
							Login
						</Button>
					</form>
				</Form>
				<div className="mt-4 text-center text-sm">
					Don&apos;t have an account?{" "}
					<Link to="/register" className="underline">
						Sign up
					</Link>
				</div>
			</CardContent>
		</Card>
	);
};
