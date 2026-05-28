import { useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	SafeAreaView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { normalizeServerUrl } from '../services/api';
import type { MobileSession } from '../types/api';

interface LoginScreenProps {
	onLogin: (session: MobileSession) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
	const [serverUrl, setServerUrl] = useState('http://localhost:5173');
	const [loginUrl, setLoginUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (loginUrl) {
		const injectedJavaScript = `
			(async () => {
				try {
					const response = await fetch('/api/mobile-token', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ label: 'iPhone' })
					});
					if (response.ok) {
						const payload = await response.json();
						window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mobile-token', payload }));
					}
				} catch (error) {}
			})();
			true;
		`;

		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.webHeader}>
					<Pressable onPress={() => setLoginUrl(null)} style={styles.secondaryButton}>
						<Text style={styles.secondaryButtonText}>Cancel</Text>
					</Pressable>
					<Text style={styles.webTitle}>Sign in</Text>
				</View>
				<WebView
					source={{ uri: loginUrl }}
					injectedJavaScript={injectedJavaScript}
					onMessage={(event) => {
						try {
							const message = JSON.parse(event.nativeEvent.data) as {
								type?: string;
								payload?: { token: string; user: MobileSession['user'] };
							};

							if (message.type === 'mobile-token' && message.payload) {
								onLogin({
									serverUrl: normalizeServerUrl(serverUrl),
									token: message.payload.token,
									user: message.payload.user
								});
							}
						} catch {
							setError('Unable to finish sign in.');
						}
					}}
					startInLoadingState
					renderLoading={() => <ActivityIndicator color="#34d399" style={styles.loader} />}
				/>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.loginPanel}>
				<Text style={styles.eyebrow}>Private music</Text>
				<Text style={styles.title}>Music Server</Text>
				<Text style={styles.copy}>
					Enter your Tailscale or local server URL, then sign in with Google.
				</Text>
				<TextInput
					value={serverUrl}
					onChangeText={setServerUrl}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					placeholder="https://music-server.tailnet.ts.net"
					placeholderTextColor="#71717a"
					style={styles.input}
				/>
				{error ? <Text style={styles.error}>{error}</Text> : null}
				<Pressable
					style={styles.primaryButton}
					onPress={() => {
						const normalizedUrl = normalizeServerUrl(serverUrl);

						if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
							setError('Server URL must start with http:// or https://.');
							return;
						}

						setError(null);
						setLoginUrl(`${normalizedUrl}/signin?callbackUrl=/`);
					}}
				>
					<Text style={styles.primaryButtonText}>Continue with Google</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#09090b'
	},
	loginPanel: {
		flex: 1,
		justifyContent: 'center',
		padding: 24
	},
	eyebrow: {
		color: '#34d399',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase'
	},
	title: {
		marginTop: 10,
		color: '#fafafa',
		fontSize: 34,
		fontWeight: '800'
	},
	copy: {
		marginTop: 12,
		color: '#a1a1aa',
		fontSize: 15,
		lineHeight: 22
	},
	input: {
		marginTop: 28,
		borderWidth: 1,
		borderColor: '#3f3f46',
		borderRadius: 8,
		paddingHorizontal: 14,
		height: 48,
		color: '#fafafa',
		backgroundColor: '#18181b'
	},
	error: {
		marginTop: 12,
		color: '#fbbf24'
	},
	primaryButton: {
		marginTop: 18,
		height: 48,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 8,
		backgroundColor: '#34d399'
	},
	primaryButtonText: {
		color: '#052e16',
		fontWeight: '800'
	},
	webHeader: {
		height: 52,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderColor: '#27272a'
	},
	webTitle: {
		color: '#fafafa',
		fontSize: 16,
		fontWeight: '700',
		marginLeft: 18
	},
	secondaryButton: {
		paddingVertical: 8
	},
	secondaryButtonText: {
		color: '#34d399',
		fontWeight: '700'
	},
	loader: {
		flex: 1,
		backgroundColor: '#09090b'
	}
});
