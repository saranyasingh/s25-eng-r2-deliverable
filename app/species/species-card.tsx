

"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import type { Database } from "@/lib/schema";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/client-utils";


// Establishes species table based on the Supabase database containing species information
type Species = Database["public"]["Tables"]["species"]["Row"]

export default function SpeciesCard({ species, user }: { species: Species; user: string }) {
  const router = useRouter();

  // Open state used to open dialog when Learn More is clicked
  const [open, setOpen] = useState<boolean>(false);

  // Defines supabase database
  const supabase = createBrowserSupabaseClient();

  // isOwner used to determine whether or not the user is allowed to edit the card
  const isOwner = species.author == user;

  // State to store user display names for comments
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({});


  // Creates a state of each variable that is editable, this is triggered if the user is the author of a species
  const [editableSpecies, setEditableSpecies] = useState({
    scientific_name: species.scientific_name ?? "",
    common_name: species.common_name ?? "",
    total_population: species.total_population ?? "",
    kingdom: species.kingdom ?? "",
    description: species.description ?? "",
    endangered: species.endangered ?? "",
  });

  // Implemented comment functionality
  const [comments, setComments] = useState<{ text: string; user: string; timestamp: string }[]>(
    species.comments ? (JSON.parse(species.comments) as { text: string; user: string; timestamp: string }[]) : []
  );
  const [newComment, setNewComment] = useState("");

  // Fetch display names
  useEffect(() => {
    const fetchDisplayNames = async () => {
      const userIds = new Set([...comments.map((comment) => comment.user), species.author]); // Include author
      if (userIds.size === 0) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(userIds));

      if (!error && data) {
        const nameMap = Object.fromEntries(data.map((profile) => [profile.id, profile.display_name]));
        setUserDisplayNames(nameMap);
      }
    };

    void fetchDisplayNames();
  }, [comments, species.author]); // Depend on `species.author`


  // When the species data is updated, updates the database
  const handleUpdateSpecies = async (updatedData: Partial<typeof editableSpecies>) => {
    const formattedData = {
      ...updatedData,
      endangered: typeof updatedData.endangered === "string"
        ? updatedData.endangered === "true"
        : updatedData.endangered,
      total_population: typeof updatedData.total_population === "string"
        ? parseInt(updatedData.total_population, 10) || null // Convert string to number, default to null if invalid
        : updatedData.total_population, // Keep number/null/undefined as is
    };

    const { error } = await supabase.from("species").update(formattedData).eq("id", species.id);
    if (error) {
      console.error("Error updating species information:", error);
    }
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const updatedData = { ...editableSpecies, [e.target.name]: e.target.value };
    setEditableSpecies(updatedData);

    void handleUpdateSpecies(updatedData);
    void router.refresh();
  };

  // Updates database when a comment is submitted
  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;

    // Updated comments database used to display new comments
    const updatedComments = [
      { text: newComment, user, timestamp: new Date().toISOString() },
      ...comments,
    ];

    const { error } = await supabase
      .from("species")
      .update({ comments: JSON.stringify(updatedComments) })
      .eq("id", species.id);

    // Catches errors in comment submission
    if (error) {
      console.error("Error adding comment:", error);
    } else {
      setComments(updatedComments);
      setNewComment("");
    }
  };

  // Functionality to delete a comment
  // When the delete button is clicked, this function is triggered to update the database
  const handleDeleteComment = async (timestamp: string) => {
    const updatedComments = comments.filter((comment) => comment.timestamp !== timestamp);

    const { error } = await supabase
      .from("species")
      .update({ comments: JSON.stringify(updatedComments) })
      .eq("id", species.id);

    if (error) {
      console.error("Error deleting comment:", error);
    } else {
      setComments(updatedComments);
    }
  };

  // Functionality to delete a species
  // When the delete button is clicked, this function is triggered to update the database
  const handleDeleteSpecies = async () => {

    const { error } = await supabase
      .from("species")
      .delete()
      .eq("id", species.id);

    if (error) {
      return toast({
        title: "Something went wrong.",
        variant: "destructive",
      });
    }

    router.refresh();

    return toast({
      title: "Successfully deleted!",
    });
  };

  // Returns the stuff we actually see on the page
  return (

    // Main page with all the species cards
    <div className="m-4 w-72 min-w-72 flex-none rounded border-2 p-3 shadow">
      {species.image && (
        <div className="relative h-40 w-full">
          <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
        </div>
      )}
      <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
      <h4 className="text-lg font-light italic">{species.common_name}</h4>
      <p>{species.description ? species.description.slice(0, 150).trim() + "..." : ""}</p>


      <Button variant="secondary" className="mt-3 w-full" onClick={() => setOpen(true)}>
        Learn More
      </Button>

      {/* FEATURE 1 IMPLEMENTED - This is the dialog that opens to display more information when Learn More is clicked*/}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>

            {/* FEATURE 2 IMPLEMENTED - If the user is the owner, the fields displayed are editable and the user can delete the species*/}
            {isOwner ? (
              <div className="space-y-6 bg-white p-6 rounded-lg shadow-md">
              {/* Scientific Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Scientific Name</label>
                <Input
                  name="scientific_name"
                  value={editableSpecies.scientific_name}
                  onChange={handleChange}
                  className="mt-1 w-full text-2xl font-semibold border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Common Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Common Name</label>
                <Input
                  name="common_name"
                  value={editableSpecies.common_name}
                  onChange={handleChange}
                  className="mt-1 w-full text-lg font-light italic border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Input restricted to numbers for total population */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Population</label>
                <Input
                  name="total_population"
                  type="number"
                  value={editableSpecies.total_population}
                  onChange={handleChange}
                  className="mt-1 w-full text-lg font-light border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Dropdown for kingdom selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Kingdom</label>
                <select
                  name="kingdom"
                  value={editableSpecies.kingdom}
                  onChange={(e) => {
                    const updatedData = {
                      ...editableSpecies,
                      kingdom: e.target.value as "Animalia" | "Plantae" | "Fungi" | "Protista" | "Archaea" | "Bacteria"
                    };
                    setEditableSpecies(updatedData);
                    void handleUpdateSpecies(updatedData);
                  }}
                  className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"].map((kingdom) => (
                    <option key={kingdom} value={kingdom}>
                      {kingdom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <Textarea
                  name="description"
                  value={editableSpecies.description}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Editable dropdown for endangered status */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Endangered Status</label>
                <select
                  name="endangered"
                  value={editableSpecies.endangered ? "true" : "false"}
                  onChange={(e) => {
                    const updatedData = { ...editableSpecies, endangered: e.target.value === "true" };
                    setEditableSpecies(updatedData);
                    void handleUpdateSpecies(updatedData);
                  }}
                  className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Endangered</option>
                  <option value="false">Not Endangered</option>
                </select>
              </div>

              {/* STRETCH GOAL -- display author information */}
              <h4 className="text-lg bold text-gray-700">
                    Author: {userDisplayNames[species.author]}
                  </h4>

              {/* STRETCH GOAL IMPLEMENTED -- functionality to delete a species */}
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  className="text-xs px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  onClick={() => void handleDeleteSpecies()}
                >
                  Delete
                </Button>
              </div>
            </div>


            ) : /* If the user is not the owner, regular, non-editable information is displayed */ (
              <div className="bg-white p-6 rounded-lg shadow-md space-y-2">
                  {/* Scientific Name */}
                  <h3 className="text-2xl font-semibold text-gray-900">{species.scientific_name}</h3>

                  {/* Common Name, Population, and Kingdom */}
                  <h4 className="text-lg font-light italic text-gray-700">
                    {species.common_name} | {species.total_population ?? "Population Unknown"} | {species.kingdom}
                  </h4>

                  {/* STRETCH GOAL -- display author information */}
                  <h4 className="text-lg bold text-gray-700">
                    Author: {userDisplayNames[species.author]}
                  </h4>

                  {/* Non-editable endangered status */}
                  {species.endangered && (
                    <h4 className="text-lg font-semibold text-red-600">Endangered</h4>
                  )}

                  {/* Species Description */}
                  <DialogDescription className="text-gray-600">{species.description}</DialogDescription>
                </div>
            )}

            {/* HARD STRETCH GOAL - This section contains implementation of a comment section */}
            <h2 className="mt-5 text-xl font-semibold">Comments</h2>
            <div className="mt-3">
              {comments.map((comment, index) => (
                <div key={index} className="mb-2 border-b pb-2">
                  <p><strong>{userDisplayNames[comment.user] ?? "Unknown"}:</strong> {comment.text}</p>
                  <p className="text-xs text-gray-500">{new Date(comment.timestamp).toLocaleString()}</p>

                  {/* Delete button only for the comment author */}
                  {comment.user === user && (
                    <Button
                      variant="destructive"
                      className="mt-1 text-xs"
                      onClick={() => void handleDeleteComment(comment.timestamp)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Textarea
              className="mt-3"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Leave a comment..."
            />
            <Button className="mt-2" onClick={() => void handleCommentSubmit()}>
              Submit Comment
            </Button>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
