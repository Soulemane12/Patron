import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { inputText, formattedInfo } = await request.json();

    // Get the user from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if user already has a draft
    const { data: existingDraft, error: fetchError } = await supabaseAdmin
      .from('customer_drafts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing draft:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check existing draft' },
        { status: 500 }
      );
    }

    let result;
    
    if (existingDraft) {
      // Update existing draft
      const { data, error } = await supabaseAdmin
        .from('customer_drafts')
        .update({
          input_text: inputText || null,
          formatted_info: formattedInfo || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating draft:', error);
        return NextResponse.json(
          { error: 'Failed to update draft' },
          { status: 500 }
        );
      }
      
      result = data;
    } else {
      // Create new draft
      const { data, error } = await supabaseAdmin
        .from('customer_drafts')
        .insert({
          user_id: user.id,
          input_text: inputText || null,
          formatted_info: formattedInfo || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating draft:', error);
        return NextResponse.json(
          { error: 'Failed to create draft' },
          { status: 500 }
        );
      }
      
      result = data;
    }

    return NextResponse.json({
      success: true,
      message: 'Draft saved successfully',
      draft: result
    });

  } catch (error) {
    console.error('Error in save draft API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
