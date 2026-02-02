import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, Text, View, TouchableOpacity, StyleSheet, FlatList } from "react-native";

const chats = [
  { id: "1", title: "Alice", lastMessage: "Привет!" },
  { id: "2", title: "Frimes Team", lastMessage: "Релиз готов" },
];

export default function App() {
  const [activeChatId, setActiveChatId] = useState("1");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.sidebar}>
        <Text style={styles.brand}>Frimes</Text>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chatItem, item.id === activeChatId && styles.chatItemActive]}
              onPress={() => setActiveChatId(item.id)}
            >
              <Text style={styles.chatTitle}>{item.title}</Text>
              <Text style={styles.chatSubtitle}>{item.lastMessage}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      <View style={styles.chatPane}>
        <Text style={styles.chatHeader}>Диалог</Text>
        <View style={styles.callActions}>
          <TouchableOpacity style={styles.callButton}>
            <Text style={styles.callButtonText}>📞 Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callButton, styles.callButtonPrimary]}>
            <Text style={[styles.callButtonText, styles.callButtonPrimaryText]}>🎥 Video</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>Готовы к WebRTC?</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0f172a",
  },
  sidebar: {
    width: 140,
    padding: 16,
    backgroundColor: "#111827",
  },
  brand: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  chatItem: {
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  chatItemActive: {
    backgroundColor: "#2563eb",
  },
  chatTitle: {
    color: "#fff",
    fontWeight: "600",
  },
  chatSubtitle: {
    color: "#cbd5f5",
    fontSize: 12,
  },
  chatPane: {
    flex: 1,
    padding: 20,
  },
  chatHeader: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  callActions: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 16,
  },
  callButton: {
    backgroundColor: "#1f2937",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  callButtonPrimary: {
    backgroundColor: "#2563eb",
  },
  callButtonText: {
    color: "#e2e8f0",
  },
  callButtonPrimaryText: {
    color: "#fff",
  },
  messageBubble: {
    backgroundColor: "#1f2937",
    padding: 16,
    borderRadius: 20,
  },
  messageText: {
    color: "#fff",
  },
});
